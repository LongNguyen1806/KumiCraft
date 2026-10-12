// DesignStore (SPEC-04.1 section 3, M-DS): in-memory document state, operation batches,
// dirty file tracking, debounced atomic persistence and rotating backups.
import { createHash } from 'node:crypto';

import {
  applyBatch,
  assignIds,
  type DesignDocument,
  type DesignOperation,
  documentToFiles,
  type OperationBatch,
  workspaceFilePath,
} from '@reactcraft/model';

import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { err, ok, type Result } from '../shared/result.ts';
import {
  backupKey,
  backupName,
  type BackupSummary,
  listBackups,
  restoreBackup,
} from '../workspace/backup-files.ts';
import { BACKUP_DIR, backupStamp } from '../workspace/backups.ts';

export type { BackupSummary };

const DEBOUNCE_MS = 500; // R-DS-01
const MAX_DEBOUNCE_MS = 2000; // NFR-06
const MAX_BACKUPS_PER_FILE = 20; // R-DS-03

export type DesignStoreDeps = {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly system: SystemPort;
  readonly logger: LoggerPort;
  readonly initialDocument: DesignDocument;
  readonly initialRevision?: number;
  readonly onSaved?: (files: readonly string[]) => void;
  readonly eventBus?: EventBusPort;
};

export type DesignStore = {
  document(): DesignDocument;
  revision(): number;
  applyBatch(
    batch: OperationBatch,
  ): Promise<Result<{ revision: number; idMap: Record<string, string> }>>;
  flush(): Promise<Result<void>>;
  reload(document: DesignDocument, revision?: number): Promise<void>;
  listBackups(): Promise<Result<readonly BackupSummary[]>>;
  restoreBackup(backupId: string): Promise<Result<{ readonly file: string }>>;
  markExternalChange(): void;
  hasExternalChange(): boolean;
  getFileHash(file: string): string | undefined;
  close(): Promise<void>;
};

const sha256 = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex');

function addTargetFile(
  files: Set<string>,
  target: { kind: 'page'; pageId: string } | { kind: 'component'; componentId: string },
): void {
  if (target.kind === 'page') {
    files.add(workspaceFilePath.page(target.pageId));
  } else {
    files.add(workspaceFilePath.component(target.componentId));
  }
}

function affectedFiles(ops: readonly DesignOperation[]): Set<string> {
  const files = new Set<string>();
  for (const op of ops) {
    if (op.op.startsWith('token.')) {
      files.add(workspaceFilePath.tokens());
    } else if (op.op === 'page.create') {
      files.add(workspaceFilePath.page(op.page.id));
      files.add(workspaceFilePath.workspace());
    } else if (op.op === 'page.delete') {
      files.add(workspaceFilePath.page(op.pageId));
      files.add(workspaceFilePath.workspace());
    } else if (op.op === 'page.update') {
      files.add(workspaceFilePath.page(op.pageId));
    } else if (op.op === 'page.reorder' || op.op === 'workspace.update') {
      files.add(workspaceFilePath.workspace());
    } else if (op.op === 'component.create') {
      files.add(workspaceFilePath.component(op.component.id));
    } else if (op.op === 'component.delete' || op.op === 'component.update') {
      files.add(workspaceFilePath.component(op.componentId));
    } else if ('target' in op) {
      addTargetFile(files, op.target);
    } else if (op.op === 'node.restoreValues') {
      for (const entry of op.entries) addTargetFile(files, entry.target);
    }
  }
  return files;
}

async function pruneOldBackups(fs: FileSystemPort, root: string, fileKey: string): Promise<void> {
  const listRes = await fs.readDir(root, BACKUP_DIR);
  if (!listRes.ok) return;

  const prefix = `${fileKey}.`;
  const matching = listRes.value
    .filter((e) => e.kind === 'file' && e.name.startsWith(prefix) && e.name.endsWith('.json'))
    .map((e) => e.name)
    .sort();

  if (matching.length > MAX_BACKUPS_PER_FILE) {
    const toDelete = matching.slice(0, matching.length - MAX_BACKUPS_PER_FILE);
    for (const name of toDelete) {
      await fs.remove(root, `${BACKUP_DIR}/${name}`);
    }
  }
}

async function saveFileWithBackup(
  deps: DesignStoreDeps,
  path: string,
  content: string,
): Promise<Result<void>> {
  const exists = await deps.fs.exists(deps.root, path);
  if (exists) {
    const fileKey = backupKey(path);
    const stamp = backupStamp(deps.system.now());
    const backupPath = `${BACKUP_DIR}/${backupName(path, stamp)}`;
    const copyRes = await deps.fs.copy(deps.root, path, backupPath);
    if (!copyRes.ok) return copyRes;
    await pruneOldBackups(deps.fs, deps.root, fileKey);
  }
  return deps.fs.writeTextAtomic(deps.root, path, content);
}

async function writeDirtyFiles(
  deps: DesignStoreDeps,
  doc: DesignDocument,
  dirty: Set<string>,
  knownHashes: Map<string, string>,
): Promise<Result<readonly string[]>> {
  const filesToWrite = documentToFiles(doc);
  const savedList: string[] = [];

  for (const path of dirty) {
    const content = filesToWrite[path];
    if (content !== undefined) {
      const writeRes = await saveFileWithBackup(deps, path, content);
      if (!writeRes.ok) return writeRes;
      knownHashes.set(path, sha256(content));
      savedList.push(path);
    } else {
      const exists = await deps.fs.exists(deps.root, path);
      if (exists) {
        const stamp = backupStamp(deps.system.now());
        await deps.fs.copy(deps.root, path, `${BACKUP_DIR}/${backupName(path, stamp)}`);
        await deps.fs.remove(deps.root, path);
      }
      knownHashes.delete(path);
      savedList.push(path);
    }
  }

  return ok(savedList);
}

function createDebouncer(deps: DesignStoreDeps, onFlush: () => Promise<Result<void>>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstUnsavedTime: number | undefined;

  return {
    clear() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      firstUnsavedTime = undefined;
    },
    schedule() {
      const now = deps.system.now().getTime();
      if (firstUnsavedTime === undefined) firstUnsavedTime = now;
      if (timer !== undefined) clearTimeout(timer);

      const elapsed = now - firstUnsavedTime;
      const remainingToMax = Math.max(0, MAX_DEBOUNCE_MS - elapsed);
      const delay = Math.min(DEBOUNCE_MS, remainingToMax);

      timer = setTimeout(() => {
        void onFlush().catch((errLog: unknown) => {
          deps.logger.error({ err: String(errLog) }, 'failed to flush dirty files');
        });
      }, delay);
    },
  };
}

function updateKnownHashes(map: Map<string, string>, doc: DesignDocument): void {
  map.clear();
  for (const [path, content] of Object.entries(documentToFiles(doc))) {
    map.set(path, sha256(content));
  }
}

function checkBatchPreconditions(
  hasExtChange: boolean,
  currentRev: number,
  baseRev: number,
): Result<void> {
  if (hasExtChange) {
    return err({
      code: 'E017',
      params: {
        currentRevision: currentRev,
        baseRevision: baseRev,
        reason: 'external_change',
      },
    });
  }
  if (baseRev !== currentRev) {
    return err({
      code: 'E017',
      params: { currentRevision: currentRev, baseRevision: baseRev },
    });
  }
  return ok(undefined);
}

function applyOperations(
  doc: DesignDocument,
  ops: OperationBatch['ops'],
): Result<{ doc: DesignDocument; idMap: Record<string, string>; affectedFiles: Set<string> }> {
  const assigned = assignIds(ops);
  const applied = applyBatch(doc, assigned.ops);
  if (!applied.ok) return applied;
  return ok({
    doc: applied.value.doc,
    idMap: assigned.idMap,
    affectedFiles: affectedFiles(assigned.ops),
  });
}

type MutableStoreState = {
  doc: DesignDocument;
  rev: number;
  hasExtChange: boolean;
  dirty: Set<string>;
};

/**
 * The revision lives in workspace.json (SPEC-04.1 section 2.3 step 6), so every batch rewrites it:
 * a restarted server goes on from the same revision and stale clients still get E017.
 */
function executeBatch(
  state: MutableStoreState,
  batch: OperationBatch,
  now: Date,
  schedule: () => void,
): Promise<Result<{ revision: number; idMap: Record<string, string> }>> {
  const check = checkBatchPreconditions(state.hasExtChange, state.rev, batch.baseRevision);
  if (!check.ok) return Promise.resolve(check);
  const res = applyOperations(state.doc, batch.ops);
  if (!res.ok) return Promise.resolve(res);
  state.rev += 1;
  const { workspace } = res.value.doc;
  state.doc = {
    ...res.value.doc,
    workspace: { ...workspace, revision: state.rev, updatedAt: now.toISOString() },
  };
  for (const file of res.value.affectedFiles) state.dirty.add(file);
  state.dirty.add(workspaceFilePath.workspace());
  schedule();
  return Promise.resolve(ok({ revision: state.rev, idMap: res.value.idMap }));
}

export function createDesignStore(deps: DesignStoreDeps): DesignStore {
  const state: MutableStoreState = {
    doc: deps.initialDocument,
    rev: deps.initialRevision ?? 1,
    hasExtChange: false,
    dirty: new Set<string>(),
  };
  const knownHashes = new Map<string, string>();
  updateKnownHashes(knownHashes, state.doc);

  async function flush(): Promise<Result<void>> {
    debouncer.clear();
    if (state.dirty.size === 0) return ok(undefined);
    const written = await writeDirtyFiles(deps, state.doc, state.dirty, knownHashes);
    if (!written.ok) return written;
    state.dirty.clear();
    deps.onSaved?.(written.value);
    deps.eventBus?.publish('workspace.saved', { revision: state.rev, files: written.value });
    return ok(undefined);
  }

  const debouncer = createDebouncer(deps, flush);

  return {
    document: () => state.doc,
    revision: () => state.rev,
    applyBatch: (batch) =>
      executeBatch(state, batch, deps.system.now(), () => {
        debouncer.schedule();
      }),
    flush,
    reload(newDoc, newRev) {
      debouncer.clear();
      state.dirty.clear();
      state.hasExtChange = false;
      state.doc = newDoc;
      state.rev = newRev ?? state.rev + 1;
      updateKnownHashes(knownHashes, state.doc);
      return Promise.resolve();
    },
    listBackups: () => listBackups(deps.fs, deps.root),
    restoreBackup: (backupId) => restoreBackup(deps.fs, deps.root, backupId),
    markExternalChange: () => {
      state.hasExtChange = true;
    },
    hasExternalChange: () => state.hasExtChange,
    getFileHash: (file) => knownHashes.get(file),
    close: async () => {
      await flush();
    },
  };
}
