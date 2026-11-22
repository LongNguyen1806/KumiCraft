// Manifest handling and hashing for backend mirrors (R-MR-01, R-MR-04).
import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { Result } from '../../kernel/result.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

export const ManifestFileItemSchema = z.strictObject({
  path: z.string(),
  size: z.number(),
  mtimeMs: z.number(),
  sha256: z.string(),
});
export type ManifestFileItem = z.infer<typeof ManifestFileItemSchema>;

export const MirrorManifestSchema = z.strictObject({
  version: z.literal(1),
  files: z.array(ManifestFileItemSchema),
});
export type MirrorManifest = z.infer<typeof MirrorManifestSchema>;

export const EMPTY_MANIFEST: MirrorManifest = { version: 1, files: [] };

export function computeSha256(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

export function manifestRelPath(projectId: string, backendId: string): string {
  return `mirrors/${projectId}/${backendId}.manifest.json`;
}

export function mirrorRelDir(projectId: string, backendId: string): string {
  return `mirrors/${projectId}/${backendId}`;
}

/** Reads and parses the manifest. Returns EMPTY_MANIFEST if missing or invalid. */
export async function readManifest(
  fs: FileSystemPort,
  cacheDir: string,
  relPath: string,
): Promise<MirrorManifest> {
  const readRes = await fs.readText(cacheDir, relPath);
  if (!readRes.ok) {
    return EMPTY_MANIFEST;
  }
  try {
    const parsedJson: unknown = JSON.parse(readRes.value);
    const parsed = MirrorManifestSchema.safeParse(parsedJson);
    return parsed.success ? parsed.data : EMPTY_MANIFEST;
  } catch {
    return EMPTY_MANIFEST;
  }
}

/** Atomically writes the manifest to the cache folder. */
export async function writeManifest(
  fs: FileSystemPort,
  cacheDir: string,
  relPath: string,
  manifest: MirrorManifest,
): Promise<Result<void>> {
  return fs.writeTextAtomic(cacheDir, relPath, JSON.stringify(manifest, undefined, 2));
}
