// Content-addressable object store for agent turn snapshots (ADR-BE-33, S-113).
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { ok, type Result } from '../../shared/result.ts';
import { SNAPSHOT_MAX_BYTES } from './snapshot-types.ts';

/** Snapshot files may be larger than the 20 MB default read limit (S-29); the project cap applies. */
export const SNAPSHOT_READ = { maxBytes: SNAPSHOT_MAX_BYTES } as const;

export function objectRelPath(projectId: string, sha: string): string {
  return `turns/${projectId}/objects/${sha.slice(0, 2)}/${sha}`;
}

export async function saveObject(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  sha: string,
  bytes: Uint8Array,
): Promise<Result<void>> {
  const relPath = objectRelPath(projectId, sha);
  if (await fs.exists(dataDir, relPath)) return ok(undefined);
  return fs.writeBytesAtomic(dataDir, relPath, bytes);
}

export async function readObject(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  sha: string,
): Promise<Result<Uint8Array>> {
  const relPath = objectRelPath(projectId, sha);
  return fs.readBytes(dataDir, relPath, SNAPSHOT_READ);
}

async function cleanPrefixDir(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  prefixName: string,
  referencedShas: ReadonlySet<string>,
): Promise<void> {
  const prefixRelDir = `turns/${projectId}/objects/${prefixName}`;
  const filesRes = await fs.readDir(dataDir, prefixRelDir);
  if (!filesRes.ok) {
    return;
  }
  for (const file of filesRes.value) {
    if (file.kind !== 'directory' && !referencedShas.has(file.name)) {
      await fs.remove(dataDir, `${prefixRelDir}/${file.name}`);
    }
  }
}

/**
 * Removes all objects under turns/<projectId>/objects that are not present in referencedShas.
 */
export async function pruneOrphanObjects(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  referencedShas: ReadonlySet<string>,
): Promise<void> {
  const objectsDir = `turns/${projectId}/objects`;
  const prefixesRes = await fs.readDir(dataDir, objectsDir);
  if (!prefixesRes.ok) {
    return;
  }
  for (const entry of prefixesRes.value) {
    if (entry.kind === 'directory') {
      await cleanPrefixDir(fs, dataDir, projectId, entry.name, referencedShas);
    }
  }
}
