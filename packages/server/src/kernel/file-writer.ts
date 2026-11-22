// The one place where an edit writes the user's files (docs/architecture/03-kien-truc-dich.md
// section 4, ADR-A2). An edit computes what each file should become; this module checks that the
// files are still as the edit read them, writes them all or none, tells History, and records the
// step for Undo. Quality goal 1 (never break the user's code) is kept here, once.
import { err, type HistoryLabel, ok, type Result } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { fileQueueKey, queueFileTask } from './file-queue.ts';
import {
  computeBytesSha256,
  computeSha256,
  writeFilesAtomicWithRollback,
} from './history/history-file-io.ts';
import type { HistoryFileChange, HistoryService } from './history/history-service.ts';

/** What one file becomes. */
export type FileChange = {
  readonly path: string;
  /** The content the edit read; `undefined`: the file did not exist and must not exist now. */
  readonly before: string | undefined;
  /** The new content; `undefined` removes the file. */
  readonly after: string | undefined;
  /** `base64`: `before` and `after` are the base64 of binary content (images). */
  readonly encoding?: 'base64' | undefined;
};

export type FileWriterDeps = {
  readonly fs: FileSystemPort;
  readonly history?: Pick<HistoryService, 'recordInternalWrite' | 'push'> | undefined;
};

export type CommitOptions = {
  /** Records one Undo step with this label; without it the caller records the step itself. */
  readonly label?: HistoryLabel | undefined;
  readonly coalesceKey?: string | undefined;
};

const BOM = '﻿';

function hashOf(content: string, encoding: 'base64' | undefined): string {
  return encoding === 'base64'
    ? computeBytesSha256(Buffer.from(content, 'base64'))
    : computeSha256(content);
}

/** The step as History stores it: contents and hashes before and after. */
export function toHistoryFiles(changes: readonly FileChange[]): HistoryFileChange[] {
  return changes.map((c) => ({
    path: c.path,
    before: c.before,
    after: c.after,
    beforeHash: c.before === undefined ? undefined : hashOf(c.before, c.encoding),
    afterHash: c.after === undefined ? undefined : hashOf(c.after, c.encoding),
    encoding: c.encoding,
  }));
}

async function currentContent(
  fs: FileSystemPort,
  root: string,
  change: FileChange,
): Promise<string | undefined> {
  if (change.encoding === 'base64') {
    const bytes = await fs.readBytes(root, change.path);
    return bytes.ok ? Buffer.from(bytes.value).toString('base64') : undefined;
  }
  const text = await fs.readText(root, change.path, { keepBom: true });
  return text.ok ? text.value : undefined;
}

/** An edit that read a file without its BOM still matches the same file with it. */
function sameContent(current: string, before: string): boolean {
  return current === before || current === BOM + before || BOM + current === before;
}

/** E017 when a file changed on disk since the edit read it (a hand edit, another tool). */
async function verifyUnchanged(
  fs: FileSystemPort,
  root: string,
  changes: readonly FileChange[],
): Promise<Result<void>> {
  for (const change of changes) {
    if (change.before === undefined) {
      if (await fs.exists(root, change.path)) {
        return err({ code: 'E017', params: { file: change.path, reason: 'fileChanged' } });
      }
      continue;
    }
    const current = await currentContent(fs, root, change);
    if (current === undefined || !sameContent(current, change.before)) {
      return err({ code: 'E017', params: { file: change.path, reason: 'fileChanged' } });
    }
  }
  return ok(undefined);
}

/**
 * Checks, writes all changes or none, tells History about the writes (so the file watcher does
 * not mistake them for hand edits) and, with `options.label`, records the Undo step. Call it inside
 * `withFileLocks` of the same files when the edit read them first.
 */
export async function commitFileChanges(
  deps: FileWriterDeps,
  root: string,
  changes: readonly FileChange[],
  options: CommitOptions = {},
): Promise<Result<readonly HistoryFileChange[]>> {
  const real = changes.filter((c) => c.before !== c.after);
  const verified = await verifyUnchanged(deps.fs, root, real);
  if (!verified.ok) return verified;
  const files = toHistoryFiles(real);
  const written = await writeFilesAtomicWithRollback(deps.fs, root, files, 'after');
  if (!written.ok) return written;
  for (const file of files) deps.history?.recordInternalWrite(file.path, file.afterHash ?? '');
  if (options.label !== undefined && files.length > 0) {
    deps.history?.push({ label: options.label, coalesceKey: options.coalesceKey, files });
  }
  return ok(files);
}

/** A file inside an entry (a file or a folder) that is moved or removed whole, as read before. */
export type EntryFile = {
  readonly path: string;
  readonly content: string;
  readonly encoding?: 'base64' | undefined;
};

/**
 * Moves a file or a whole folder with one rename (fast, and atomic for a folder), after checking
 * each file inside is still as read; Undo puts every file back (R-HI-11).
 */
export async function moveEntry(
  deps: FileWriterDeps,
  root: string,
  move: { readonly from: string; readonly to: string; readonly files: readonly EntryFile[] },
  options: CommitOptions,
): Promise<Result<readonly HistoryFileChange[]>> {
  const target = (p: string) => `${move.to}${p.slice(move.from.length)}`;
  const changes: FileChange[] = move.files.flatMap((f) => [
    { path: f.path, before: f.content, after: undefined, encoding: f.encoding },
    { path: target(f.path), before: undefined, after: f.content, encoding: f.encoding },
  ]);
  return applyEntry(deps, root, changes, () => renameEntry(deps.fs, root, move), options);
}

/** A rename that only changes letter case goes through a temp name (Windows and macOS disks). */
async function renameEntry(
  fs: FileSystemPort,
  root: string,
  move: { readonly from: string; readonly to: string },
): Promise<Result<void>> {
  if (move.from !== move.to && move.from.toLowerCase() === move.to.toLowerCase()) {
    const temp = `${move.from}.__kctmp_${String(Date.now())}`;
    const first = await fs.rename(root, move.from, temp);
    if (!first.ok) return first;
    return fs.rename(root, temp, move.to);
  }
  return fs.rename(root, move.from, move.to);
}

/** Removes a file or a whole folder with one call, after the same check; Undo restores it. */
export async function removeEntry(
  deps: FileWriterDeps,
  root: string,
  entry: { readonly path: string; readonly files: readonly EntryFile[] },
  options: CommitOptions,
): Promise<Result<readonly HistoryFileChange[]>> {
  const changes: FileChange[] = entry.files.map((f) => ({
    path: f.path,
    before: f.content,
    after: undefined,
    encoding: f.encoding,
  }));
  return applyEntry(deps, root, changes, () => deps.fs.remove(root, entry.path), options);
}

async function applyEntry(
  deps: FileWriterDeps,
  root: string,
  changes: readonly FileChange[],
  apply: () => Promise<Result<void>>,
  options: CommitOptions,
): Promise<Result<readonly HistoryFileChange[]>> {
  const gone = changes.filter((c) => c.after === undefined);
  const verified = await verifyUnchanged(deps.fs, root, gone);
  if (!verified.ok) return verified;
  const files = toHistoryFiles(changes);
  for (const file of files) deps.history?.recordInternalWrite(file.path, file.afterHash ?? '');
  const applied = await apply();
  if (!applied.ok) return applied;
  if (options.label !== undefined && files.length > 0) {
    deps.history?.push({ label: options.label, coalesceKey: options.coalesceKey, files });
  }
  return ok(files);
}

/** Runs `task` while holding the queue of every file in `files` (sorted, so no deadlock). */
export async function withFileLocks<T>(
  projectRoot: string,
  files: readonly string[],
  task: () => Promise<T>,
): Promise<T> {
  const sorted = [...new Set(files)].sort();
  const run = (index: number): Promise<T> => {
    const file = sorted[index];
    if (file === undefined) return task();
    return queueFileTask(fileQueueKey(projectRoot, file), () => run(index + 1));
  };
  return run(0);
}
