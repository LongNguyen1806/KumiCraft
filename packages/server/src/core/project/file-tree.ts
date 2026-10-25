// File tree listing for the Project File Tree (SPEC-04 K3b, spec-log #70).
import type { FileTreeEntry, FileTreeListing } from '@kumicraft/shared';
import { err, ok, type Result } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

export const IGNORED_DIR_NAMES = new Set(['node_modules', '.git', 'dist', '.kumicraft', '.vite']);

export function isIgnoredPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/');
  return segments.some((seg) => IGNORED_DIR_NAMES.has(seg));
}

export async function listFileTree(
  fs: FileSystemPort,
  projectRoot: string,
  dir: string,
): Promise<Result<FileTreeListing>> {
  const cleanDir = dir
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (cleanDir && isIgnoredPath(cleanDir)) {
    return err({ code: 'E012', params: { path: cleanDir } });
  }

  const readRes = await fs.readDir(projectRoot, cleanDir || '.');
  if (!readRes.ok) {
    return readRes;
  }

  const filtered: FileTreeEntry[] = [];
  for (const entry of readRes.value) {
    if (IGNORED_DIR_NAMES.has(entry.name)) {
      continue;
    }
    const relPath = cleanDir ? `${cleanDir}/${entry.name}` : entry.name;
    filtered.push({
      name: entry.name,
      path: relPath,
      kind: entry.kind,
      hidden: entry.name.startsWith('.'),
    });
  }

  filtered.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const MAX_ENTRIES = 2000;
  const truncated = filtered.length > MAX_ENTRIES;
  const entries = truncated ? filtered.slice(0, MAX_ENTRIES) : filtered;

  return ok({
    dir: cleanDir,
    entries,
    truncated,
  });
}
