// Turn snapshot store implementation (WP-3.04, ADR-BE-33, ADR-BE-17, S-113, R-AG-12, R-AG-15).
import type { TurnFile } from '@kumicraft/shared';
import { createTwoFilesPatch } from 'diff';

import { computeSha256 } from '../../mirror/mirror-manifest.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { LoggerPort } from '../../ports/logger-port.ts';
import { err, ok, type Result } from '../../shared/result.ts';
import {
  getLatestManifest,
  pruneTurns,
  readManifest,
  removeTurnManifests,
  writeManifest,
} from './snapshot-manifest.ts';
import { readObject, saveObject, SNAPSHOT_READ } from './snapshot-objects.ts';
import { isBinaryFile, type ScannedFile, scanProject } from './snapshot-scan.ts';
import {
  SNAPSHOT_DIFF_MAX_BYTES,
  SNAPSHOT_KEEP_TURNS,
  SNAPSHOT_MAX_BYTES,
  type SnapshotEntry,
  type SnapshotStoreDeps,
  type SnapshotStoreOptions,
  type TurnManifest,
  type TurnSnapshotStore,
} from './snapshot-types.ts';

const ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

/** Index of earlier entries by path, so an unchanged file (same size and mtime) is not read again. */
function indexByPath(entries: readonly SnapshotEntry[]): ReadonlyMap<string, SnapshotEntry> {
  return new Map(entries.map((entry) => [entry.path, entry]));
}

/** Hashes the scanned files, reusing known hashes, and stores every new content once. */
async function hashFiles(
  deps: SnapshotStoreDeps,
  projectId: string,
  projectRoot: string,
  scanned: readonly ScannedFile[],
  known: ReadonlyMap<string, SnapshotEntry>,
): Promise<Result<SnapshotEntry[]>> {
  const entries: SnapshotEntry[] = [];
  for (const file of scanned) {
    const previous = known.get(file.path);
    if (
      previous !== undefined &&
      previous.size === file.size &&
      previous.mtimeMs === file.mtimeMs
    ) {
      entries.push({ ...previous });
      continue;
    }
    const bytesRes = await deps.fs.readBytes(projectRoot, file.path, SNAPSHOT_READ);
    if (!bytesRes.ok) return bytesRes;
    const sha = computeSha256(bytesRes.value);
    const saved = await saveObject(deps.fs, deps.dataDir, projectId, sha, bytesRes.value);
    if (!saved.ok) return saved;
    entries.push({ path: file.path, sha256: sha, size: file.size, mtimeMs: file.mtimeMs });
  }
  return ok(entries);
}

function buildChanges(
  beforeEntries: readonly SnapshotEntry[],
  afterEntries: readonly SnapshotEntry[],
): readonly TurnFile[] {
  const beforeMap = new Map<string, SnapshotEntry>();
  for (const b of beforeEntries) {
    beforeMap.set(b.path, b);
  }
  const afterMap = new Map<string, SnapshotEntry>();
  for (const a of afterEntries) {
    afterMap.set(a.path, a);
  }

  const allPaths = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);
  const sortedPaths = Array.from(allPaths).sort((a, b) => a.localeCompare(b));

  const changes: TurnFile[] = [];
  for (const path of sortedPaths) {
    const beforeItem = beforeMap.get(path);
    const afterItem = afterMap.get(path);
    if (beforeItem !== undefined && afterItem !== undefined) {
      if (beforeItem.sha256 !== afterItem.sha256) {
        changes.push({ path, change: 'modified' });
      }
    } else if (afterItem !== undefined) {
      changes.push({ path, change: 'created' });
    } else if (beforeItem !== undefined) {
      changes.push({ path, change: 'deleted' });
    }
  }
  return changes;
}

async function checkRevertPreconditions(
  fs: FileSystemPort,
  projectRoot: string,
  changes: readonly TurnFile[],
  afterMap: ReadonlyMap<string, SnapshotEntry>,
): Promise<Result<void>> {
  for (const item of changes) {
    if (item.change === 'modified' || item.change === 'created') {
      const readRes = await fs.readBytes(projectRoot, item.path, SNAPSHOT_READ);
      if (!readRes.ok) {
        return err({ code: 'E017', params: { file: item.path, reason: 'fileChanged' } });
      }
      const sha = computeSha256(readRes.value);
      const expectedSha = afterMap.get(item.path)?.sha256;
      if (sha !== expectedSha) {
        return err({ code: 'E017', params: { file: item.path, reason: 'fileChanged' } });
      }
    } else {
      const fileExists = await fs.exists(projectRoot, item.path);
      if (fileExists) {
        return err({ code: 'E017', params: { file: item.path, reason: 'fileChanged' } });
      }
    }
  }
  return ok(undefined);
}

async function applyRevertItem(
  fs: FileSystemPort,
  projectRoot: string,
  dataDir: string,
  projectId: string,
  item: TurnFile,
  beforeMap: ReadonlyMap<string, SnapshotEntry>,
  logger: LoggerPort,
): Promise<Result<void>> {
  if (item.change === 'modified' || item.change === 'deleted') {
    const beforeEntry = beforeMap.get(item.path);
    if (beforeEntry === undefined) {
      logger.warn({}, 'revert_missing_entry');
      return err({ code: 'E015', params: { resource: 'file', id: item.path } });
    }
    const objRes = await readObject(fs, dataDir, projectId, beforeEntry.sha256);
    if (!objRes.ok) {
      logger.warn({ errorCode: objRes.error.code }, 'revert_failed');
      return err(objRes.error);
    }
    const writeRes = await fs.writeBytesAtomic(projectRoot, item.path, objRes.value);
    if (!writeRes.ok) {
      logger.warn({ errorCode: writeRes.error.code }, 'revert_failed');
      return err(writeRes.error);
    }
    return ok(undefined);
  }
  const rmRes = await fs.remove(projectRoot, item.path);
  if (!rmRes.ok) {
    logger.warn({ errorCode: rmRes.error.code }, 'revert_failed');
    return err(rmRes.error);
  }
  return ok(undefined);
}

async function readObjectBytes(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  sha?: string,
): Promise<Uint8Array> {
  if (sha === undefined) {
    return new Uint8Array(0);
  }
  const res = await readObject(fs, dataDir, projectId, sha);
  return res.ok ? res.value : new Uint8Array(0);
}

async function captureSnapshot(
  deps: SnapshotStoreDeps,
  options: SnapshotStoreOptions,
  projectId: string,
  projectRoot: string,
  turnId: string,
): Promise<Result<{ readonly files: number; readonly bytes: number }>> {
  if (!ID_REGEX.test(projectId) || !ID_REGEX.test(turnId)) {
    return err({ code: 'E016', params: { reason: 'invalidId' } });
  }
  const maxBytes = options.maxBytes ?? SNAPSHOT_MAX_BYTES;
  const keepTurns = options.keepTurns ?? SNAPSHOT_KEEP_TURNS;
  const scanned = await scanProject(deps.fs, projectRoot);
  const totalBytes = scanned.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > maxBytes) {
    return err({
      code: 'E016',
      params: { reason: 'projectTooLarge', limitBytes: maxBytes },
    });
  }

  const latest = await getLatestManifest(deps.fs, deps.dataDir, projectId);
  const known = indexByPath(latest?.after ?? latest?.before ?? []);
  const hashed = await hashFiles(deps, projectId, projectRoot, scanned, known);
  if (!hashed.ok) return hashed;
  const before = hashed.value;

  const manifest: TurnManifest = {
    version: 1,
    turnId,
    createdAt: new Date().toISOString(),
    before,
    reverted: false,
  };
  const written = await writeManifest(deps.fs, deps.dataDir, projectId, manifest);
  if (!written.ok) return written;
  await pruneTurns(deps.fs, deps.dataDir, projectId, keepTurns);
  return ok({ files: before.length, bytes: totalBytes });
}

async function finishSnapshot(
  deps: SnapshotStoreDeps,
  projectId: string,
  projectRoot: string,
  turnId: string,
): Promise<Result<readonly TurnFile[]>> {
  if (!ID_REGEX.test(projectId) || !ID_REGEX.test(turnId)) {
    return err({ code: 'E016', params: { reason: 'invalidId' } });
  }
  const manifest = await readManifest(deps.fs, deps.dataDir, projectId, turnId);
  if (manifest === undefined) {
    return err({ code: 'E015', params: { resource: 'turn', id: turnId } });
  }

  const scanned = await scanProject(deps.fs, projectRoot);
  const hashed = await hashFiles(
    deps,
    projectId,
    projectRoot,
    scanned,
    indexByPath(manifest.before),
  );
  if (!hashed.ok) return hashed;
  const after = hashed.value;

  const changes = buildChanges(manifest.before, after);
  const updated: TurnManifest = { ...manifest, after, changes };
  const written = await writeManifest(deps.fs, deps.dataDir, projectId, updated);
  if (!written.ok) return written;
  return ok(changes);
}

async function diffSnapshot(
  deps: SnapshotStoreDeps,
  projectId: string,
  turnId: string,
  path: string,
): Promise<Result<string>> {
  if (!ID_REGEX.test(projectId) || !ID_REGEX.test(turnId)) {
    return err({ code: 'E016', params: { reason: 'invalidId' } });
  }
  const manifest = await readManifest(deps.fs, deps.dataDir, projectId, turnId);
  if (manifest === undefined) {
    return err({ code: 'E015', params: { resource: 'turn', id: turnId } });
  }
  const changeItem = manifest.changes?.find((c) => c.path === path);
  if (changeItem === undefined) {
    return err({ code: 'E015', params: { resource: 'file', id: path } });
  }

  const beforeEntry = manifest.before.find((e) => e.path === path);
  const afterEntry = manifest.after?.find((e) => e.path === path);
  const beforeBytes = await readObjectBytes(deps.fs, deps.dataDir, projectId, beforeEntry?.sha256);
  const afterBytes = await readObjectBytes(deps.fs, deps.dataDir, projectId, afterEntry?.sha256);

  if (
    beforeBytes.length > SNAPSHOT_DIFF_MAX_BYTES ||
    afterBytes.length > SNAPSHOT_DIFF_MAX_BYTES ||
    isBinaryFile(beforeBytes) ||
    isBinaryFile(afterBytes)
  ) {
    return ok(`Binary or large file changed: ${path}\n`);
  }

  const beforeStr = new TextDecoder('utf-8').decode(beforeBytes);
  const afterStr = new TextDecoder('utf-8').decode(afterBytes);
  const patch = createTwoFilesPatch(path, path, beforeStr, afterStr, '', '', { context: 3 });
  return ok(patch);
}

async function revertSnapshot(
  deps: SnapshotStoreDeps,
  projectId: string,
  projectRoot: string,
  turnId: string,
): Promise<Result<readonly TurnFile[]>> {
  if (!ID_REGEX.test(projectId) || !ID_REGEX.test(turnId)) {
    return err({ code: 'E016', params: { reason: 'invalidId' } });
  }
  const manifest = await readManifest(deps.fs, deps.dataDir, projectId, turnId);
  if (manifest === undefined || manifest.changes === undefined || manifest.after === undefined) {
    return err({ code: 'E015', params: { resource: 'turn', id: turnId } });
  }
  if (manifest.reverted) {
    return err({ code: 'E016', params: { reason: 'alreadyReverted' } });
  }

  const afterMap = new Map<string, SnapshotEntry>();
  for (const a of manifest.after) {
    afterMap.set(a.path, a);
  }
  const checkRes = await checkRevertPreconditions(deps.fs, projectRoot, manifest.changes, afterMap);
  if (!checkRes.ok) {
    return checkRes;
  }

  const beforeMap = new Map<string, SnapshotEntry>();
  for (const b of manifest.before) {
    beforeMap.set(b.path, b);
  }
  for (const item of manifest.changes) {
    const itemRes = await applyRevertItem(
      deps.fs,
      projectRoot,
      deps.dataDir,
      projectId,
      item,
      beforeMap,
      deps.logger,
    );
    if (!itemRes.ok) {
      return itemRes;
    }
  }

  const updated: TurnManifest = { ...manifest, reverted: true };
  const written = await writeManifest(deps.fs, deps.dataDir, projectId, updated);
  if (!written.ok) return written;
  return ok(manifest.changes);
}

export function createTurnSnapshotStore(
  deps: SnapshotStoreDeps,
  options: SnapshotStoreOptions = {},
): TurnSnapshotStore {
  return {
    capture: (projectId, projectRoot, turnId) =>
      captureSnapshot(deps, options, projectId, projectRoot, turnId),
    finish: (projectId, projectRoot, turnId) =>
      finishSnapshot(deps, projectId, projectRoot, turnId),
    diff: (projectId, turnId, path) => diffSnapshot(deps, projectId, turnId, path),
    revert: (projectId, projectRoot, turnId) =>
      revertSnapshot(deps, projectId, projectRoot, turnId),
    async forget(projectId, turnIds) {
      if (!ID_REGEX.test(projectId)) return;
      const ids = new Set(turnIds.filter((id) => ID_REGEX.test(id)));
      if (ids.size > 0) await removeTurnManifests(deps.fs, deps.dataDir, projectId, ids);
    },
  };
}
