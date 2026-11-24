// History Service implementing M-HI (SPEC-03 section 5.6, SPEC-04 section 7).
import type { HistoryLabel, HistoryState, HistoryStep, Result } from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';
import { nanoid } from 'nanoid';

import type { EventBusPort } from '../../ports/event-bus-port.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { fileQueueKey, queueFileTask } from '../file-queue.ts';
import {
  computeBytesSha256,
  computeSha256,
  verifyFilesMatchHash,
  writeFilesAtomicWithRollback,
} from './history-file-io.ts';
import type { HistoryFileChange } from './history-types.ts';

export { computeBytesSha256, computeSha256 };

const MAX_HISTORY_ITEMS = 200; // R-HI-07
const MAX_HISTORY_BYTES = 50 * 1024 * 1024; // 50 MB (R-HI-07)
const COALESCE_WINDOW_MS = 500; // R-HI-02

export type HistoryEntry = {
  readonly id: string;
  readonly label: HistoryLabel;
  readonly coalesceKey?: string | undefined;
  readonly files: readonly HistoryFileChange[];
  readonly updatedAt: number;
};

export type HistoryServiceDeps = {
  readonly fs: FileSystemPort;
  readonly eventBus?: EventBusPort | undefined;
  readonly now?: () => number;
  /** Called with project-relative paths after push, undo, or redo commits file changes. */
  readonly onFilesApplied?: ((files: readonly string[]) => void) | undefined;
};

type HistoryContext = {
  readonly undoStack: HistoryEntry[];
  readonly redoStack: HistoryEntry[];
  readonly lastWrittenHashes: Map<string, string>;
  undoneSinceLastPush: boolean;
};

export interface HistoryService {
  getState(): HistoryState;
  push(input: {
    readonly id?: string | undefined;
    readonly label: HistoryLabel;
    readonly coalesceKey?: string | undefined;
    readonly files: readonly HistoryFileChange[];
  }): void;
  undo(projectRoot: string): Promise<Result<HistoryStep>>;
  redo(projectRoot: string): Promise<Result<HistoryStep>>;
  recordInternalWrite(filePath: string, writtenHash: string): void;
  handleExternalChange(filePath: string, newHash: string): boolean;
  clear(): void;
}

const byteLen = (content?: string, enc?: 'base64') =>
  content !== undefined ? Buffer.byteLength(content, enc ?? 'utf8') : 0;

function calculateEntryBytes(entry: HistoryEntry): number {
  return entry.files.reduce(
    (sum, f) => sum + byteLen(f.before, f.encoding) + byteLen(f.after, f.encoding),
    0,
  );
}

function canCoalesce(
  top: HistoryEntry | undefined,
  input: {
    readonly coalesceKey?: string | undefined;
    readonly files: readonly HistoryFileChange[];
  },
  undoneSinceLastPush: boolean,
  nowMs: number,
): boolean {
  if (undoneSinceLastPush || !top || !input.coalesceKey || !top.coalesceKey) {
    return false;
  }
  if (top.coalesceKey !== input.coalesceKey) return false;
  if (top.files.length !== 1 || input.files.length !== 1) return false;

  const topFile = top.files[0];
  const nextFile = input.files[0];
  if (topFile === undefined || nextFile === undefined) return false;
  if (topFile.path !== nextFile.path) return false;

  return nowMs - top.updatedAt <= COALESCE_WINDOW_MS;
}

function coalesceEntry(
  top: HistoryEntry,
  input: {
    readonly label: HistoryLabel;
    readonly coalesceKey?: string | undefined;
    readonly files: readonly HistoryFileChange[];
  },
  nowMs: number,
): HistoryEntry {
  const topFile = top.files[0];
  const nextFile = input.files[0];
  const mergedFile: HistoryFileChange = {
    path: topFile?.path ?? '',
    before: topFile?.before,
    beforeHash: topFile?.beforeHash,
    after: nextFile?.after,
    afterHash: nextFile?.afterHash,
    encoding: topFile?.encoding ?? nextFile?.encoding,
  };
  return {
    id: top.id,
    label: input.label,
    coalesceKey: top.coalesceKey,
    files: [mergedFile],
    updatedAt: nowMs,
  };
}

function trimToLimits(undoStack: HistoryEntry[], redoStack: readonly HistoryEntry[]): void {
  function getTotalBytes(): number {
    let total = 0;
    for (const e of undoStack) total += calculateEntryBytes(e);
    for (const e of redoStack) total += calculateEntryBytes(e);
    return total;
  }

  while (
    undoStack.length > 0 &&
    (undoStack.length > MAX_HISTORY_ITEMS || getTotalBytes() > MAX_HISTORY_BYTES)
  ) {
    undoStack.shift();
  }
}

function getHistoryState(ctx: HistoryContext): HistoryState {
  const topUndo = ctx.undoStack[ctx.undoStack.length - 1];
  const topRedo = ctx.redoStack[ctx.redoStack.length - 1];
  return {
    undo: topUndo?.label,
    redo: topRedo?.label,
    undoCount: ctx.undoStack.length,
    redoCount: ctx.redoStack.length,
  };
}

function discardEntriesForFile(ctx: HistoryContext, filePath: string): boolean {
  let changed = false;
  for (let i = ctx.undoStack.length - 1; i >= 0; i--) {
    if (ctx.undoStack[i]?.files.some((f) => f.path === filePath)) {
      ctx.undoStack.splice(i, 1);
      changed = true;
    }
  }
  for (let i = ctx.redoStack.length - 1; i >= 0; i--) {
    if (ctx.redoStack[i]?.files.some((f) => f.path === filePath)) {
      ctx.redoStack.splice(i, 1);
      changed = true;
    }
  }
  return changed;
}

function executePush(
  ctx: HistoryContext,
  input: {
    readonly id?: string | undefined;
    readonly label: HistoryLabel;
    readonly coalesceKey?: string | undefined;
    readonly files: readonly HistoryFileChange[];
  },
  nowMs: number,
): void {
  for (const f of input.files) {
    ctx.lastWrittenHashes.set(f.path, f.afterHash ?? '');
  }

  const top = ctx.undoStack[ctx.undoStack.length - 1];
  if (canCoalesce(top, input, ctx.undoneSinceLastPush, nowMs) && top !== undefined) {
    ctx.undoStack[ctx.undoStack.length - 1] = coalesceEntry(top, input, nowMs);
  } else {
    ctx.undoStack.push({
      id: input.id ?? nanoid(),
      label: input.label,
      coalesceKey: input.coalesceKey,
      files: input.files,
      updatedAt: nowMs,
    });
  }

  ctx.redoStack.length = 0; // R-HI-03
  ctx.undoneSinceLastPush = false;
  trimToLimits(ctx.undoStack, ctx.redoStack);
}

async function executeUndo(
  deps: HistoryServiceDeps,
  ctx: HistoryContext,
  projectRoot: string,
): Promise<Result<HistoryStep>> {
  if (ctx.undoStack.length === 0) {
    return err({ code: 'E015', params: { resource: 'history' } });
  }
  const top = ctx.undoStack[ctx.undoStack.length - 1];
  if (!top) return err({ code: 'E015', params: { resource: 'history' } });

  const check = await verifyFilesMatchHash(deps.fs, projectRoot, top.files, 'after');
  if (!check.ok) {
    discardEntriesForFile(ctx, check.mismatchFile);
    deps.eventBus?.publish('history.changed', getHistoryState(ctx));
    return err({ code: 'E017', params: { file: check.mismatchFile, reason: 'fileChanged' } });
  }

  const writeRes = await writeFilesAtomicWithRollback(deps.fs, projectRoot, top.files, 'before');
  if (!writeRes.ok) return writeRes;

  for (const f of top.files) {
    ctx.lastWrittenHashes.set(f.path, f.beforeHash ?? '');
  }

  ctx.undoStack.pop();
  ctx.redoStack.push(top);
  ctx.undoneSinceLastPush = true;
  const files = top.files.map((f) => f.path);
  deps.onFilesApplied?.(files);
  deps.eventBus?.publish('history.changed', getHistoryState(ctx));

  return ok({
    state: getHistoryState(ctx),
    files,
  });
}

async function executeRedo(
  deps: HistoryServiceDeps,
  ctx: HistoryContext,
  projectRoot: string,
): Promise<Result<HistoryStep>> {
  if (ctx.redoStack.length === 0) {
    return err({ code: 'E015', params: { resource: 'history' } });
  }
  const top = ctx.redoStack[ctx.redoStack.length - 1];
  if (!top) return err({ code: 'E015', params: { resource: 'history' } });

  const check = await verifyFilesMatchHash(deps.fs, projectRoot, top.files, 'before');
  if (!check.ok) {
    discardEntriesForFile(ctx, check.mismatchFile);
    deps.eventBus?.publish('history.changed', getHistoryState(ctx));
    return err({ code: 'E017', params: { file: check.mismatchFile, reason: 'fileChanged' } });
  }

  const writeRes = await writeFilesAtomicWithRollback(deps.fs, projectRoot, top.files, 'after');
  if (!writeRes.ok) return writeRes;

  for (const f of top.files) {
    ctx.lastWrittenHashes.set(f.path, f.afterHash ?? '');
  }

  ctx.redoStack.pop();
  ctx.undoStack.push(top);
  const files = top.files.map((f) => f.path);
  deps.onFilesApplied?.(files);
  deps.eventBus?.publish('history.changed', getHistoryState(ctx));

  return ok({
    state: getHistoryState(ctx),
    files,
  });
}

const topFiles = (stack: readonly HistoryEntry[]): readonly string[] =>
  stack[stack.length - 1]?.files.map((file) => file.path) ?? [];

/**
 * Runs `task` while holding the Source Editor queue of every file it writes (R-HI-06): an Undo never
 * interleaves with an edit of the same file. Queues are taken in path order, so two tasks on the same
 * files cannot wait for each other.
 */
function withFileQueues<T>(
  projectRoot: string,
  paths: readonly string[],
  task: () => Promise<T>,
): Promise<T> {
  const [first, ...rest] = [...new Set(paths)].sort();
  if (first === undefined) return task();
  return queueFileTask(fileQueueKey(projectRoot, first), () =>
    withFileQueues(projectRoot, rest, task),
  );
}

export function createHistoryService(deps: HistoryServiceDeps): HistoryService {
  const ctx: HistoryContext = {
    undoStack: [],
    redoStack: [],
    lastWrittenHashes: new Map<string, string>(),
    undoneSinceLastPush: false,
  };

  const nowFn = deps.now ?? (() => Date.now());

  return {
    getState: () => getHistoryState(ctx),
    push: (input) => {
      executePush(ctx, input, nowFn());
      deps.onFilesApplied?.(input.files.map((f) => f.path));
      deps.eventBus?.publish('history.changed', getHistoryState(ctx));
    },
    undo: (projectRoot) =>
      withFileQueues(projectRoot, topFiles(ctx.undoStack), () =>
        executeUndo(deps, ctx, projectRoot),
      ),
    redo: (projectRoot) =>
      withFileQueues(projectRoot, topFiles(ctx.redoStack), () =>
        executeRedo(deps, ctx, projectRoot),
      ),
    recordInternalWrite: (filePath, writtenHash) => {
      ctx.lastWrittenHashes.set(filePath, writtenHash);
    },
    handleExternalChange: (filePath, newHash) => {
      const knownHash = ctx.lastWrittenHashes.get(filePath);
      if (knownHash !== undefined && knownHash === newHash) {
        return false;
      }
      const discarded = discardEntriesForFile(ctx, filePath);
      if (discarded) {
        deps.eventBus?.publish('history.changed', getHistoryState(ctx));
      }
      // The project watcher sends one batched `project.filesChanged` for all files (V-70).
      return true;
    },
    clear: () => {
      ctx.undoStack.length = 0;
      ctx.redoStack.length = 0;
      ctx.lastWrittenHashes.clear();
      ctx.undoneSinceLastPush = false;
      deps.eventBus?.publish('history.changed', getHistoryState(ctx));
    },
  };
}

export type { HistoryFileChange };
