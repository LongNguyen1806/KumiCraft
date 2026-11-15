// Manifest reading, writing, and pruning for turn snapshots (S-113, ADR-BE-33).
import { TurnFileSchema } from '@kumicraft/shared';
import { z } from 'zod';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { Result } from '../../shared/result.ts';
import { pruneOrphanObjects } from './snapshot-objects.ts';
import type { TurnManifest } from './snapshot-types.ts';

export const SnapshotEntrySchema = z.strictObject({
  path: z.string(),
  sha256: z.string(),
  size: z.number(),
  mtimeMs: z.number(),
});

export const TurnManifestSchema = z.strictObject({
  version: z.literal(1),
  turnId: z.string(),
  createdAt: z.string(),
  before: z.array(SnapshotEntrySchema),
  after: z.array(SnapshotEntrySchema).optional(),
  changes: z.array(TurnFileSchema).optional(),
  reverted: z.boolean(),
});

export function manifestRelPath(projectId: string, turnId: string): string {
  return `turns/${projectId}/${turnId}.json`;
}

export async function readManifest(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  turnId: string,
): Promise<TurnManifest | undefined> {
  const readRes = await fs.readText(dataDir, manifestRelPath(projectId, turnId));
  if (!readRes.ok) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(readRes.value);
    const validated = TurnManifestSchema.safeParse(parsed);
    return validated.success ? validated.data : undefined;
  } catch {
    return undefined;
  }
}

export async function writeManifest(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  manifest: TurnManifest,
): Promise<Result<void>> {
  const relPath = manifestRelPath(projectId, manifest.turnId);
  return fs.writeTextAtomic(dataDir, relPath, JSON.stringify(manifest, undefined, 2));
}

export async function listProjectManifests(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
): Promise<readonly TurnManifest[]> {
  const dirRes = await fs.readDir(dataDir, `turns/${projectId}`);
  if (!dirRes.ok) {
    return [];
  }
  const manifests: TurnManifest[] = [];
  for (const entry of dirRes.value) {
    if (entry.kind !== 'directory' && entry.name.endsWith('.json')) {
      const turnId = entry.name.slice(0, -5);
      const manifest = await readManifest(fs, dataDir, projectId, turnId);
      if (manifest !== undefined) {
        manifests.push(manifest);
      }
    }
  }
  manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return manifests;
}

export async function getLatestManifest(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
): Promise<TurnManifest | undefined> {
  const manifests = await listProjectManifests(fs, dataDir, projectId);
  return manifests[0];
}

function collectReferencedShas(manifests: readonly TurnManifest[]): Set<string> {
  const shas = new Set<string>();
  for (const m of manifests) {
    for (const entry of m.before) {
      shas.add(entry.sha256);
    }
    if (m.after !== undefined) {
      for (const entry of m.after) {
        shas.add(entry.sha256);
      }
    }
  }
  return shas;
}

export async function pruneTurns(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  keepTurns: number,
): Promise<void> {
  const manifests = await listProjectManifests(fs, dataDir, projectId);
  const toKeep = manifests.slice(0, keepTurns);
  const toRemove = manifests.slice(keepTurns);

  for (const m of toRemove) {
    await fs.remove(dataDir, manifestRelPath(projectId, m.turnId));
  }

  const referencedShas = collectReferencedShas(toKeep);
  await pruneOrphanObjects(fs, dataDir, projectId, referencedShas);
}

/** Removes the undo snapshots of `turnIds` and the stored files no other snapshot still uses. */
export async function removeTurnManifests(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
  turnIds: ReadonlySet<string>,
): Promise<void> {
  const manifests = await listProjectManifests(fs, dataDir, projectId);
  for (const m of manifests) {
    if (turnIds.has(m.turnId)) await fs.remove(dataDir, manifestRelPath(projectId, m.turnId));
  }
  const kept = manifests.filter((m) => !turnIds.has(m.turnId));
  await pruneOrphanObjects(fs, dataDir, projectId, collectReferencedShas(kept));
}
