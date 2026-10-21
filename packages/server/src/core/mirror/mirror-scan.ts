// Recursive scanning and filtering for backend mirrors (S-30, S-31, S-120, S-121, S-122).
import ignore, { type Ignore } from 'ignore';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { isSecretPath } from '../shared/secret-paths.ts';
import {
  MIRROR_EXCLUDED_DIRS,
  MIRROR_MAX_FILE_BYTES,
  MIRROR_MAX_TOTAL_BYTES,
} from './mirror-types.ts';

const EXCLUDED_DIRS = new Set<string>(MIRROR_EXCLUDED_DIRS);

export type CandidateFile = {
  readonly path: string;
  readonly size: number;
  readonly mtimeMs: number;
};

export type ScanResult =
  | { readonly kind: 'ok'; readonly files: readonly CandidateFile[]; readonly totalBytes: number }
  | { readonly kind: 'tooLarge' };

export function isBinaryFile(bytes: Uint8Array): boolean {
  const limit = Math.min(8192, bytes.length);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0) {
      return true;
    }
  }
  return false;
}

export async function loadRootIgnore(fs: FileSystemPort, root: string): Promise<Ignore> {
  const ig = ignore();
  const readRes = await fs.readText(root, '.gitignore');
  if (readRes.ok && readRes.value.length > 0) {
    ig.add(readRes.value);
  }
  return ig;
}

export type ScanLimits = {
  readonly maxFileBytes?: number;
  readonly maxTotalBytes?: number;
};

async function processDirectoryEntries(
  fs: FileSystemPort,
  root: string,
  currentDir: string,
  ig: Ignore,
  queue: string[],
): Promise<readonly { readonly path: string; readonly name: string }[]> {
  const dirRes = await fs.readDir(root, currentDir);
  if (!dirRes.ok) {
    return [];
  }
  const files: { readonly path: string; readonly name: string }[] = [];
  for (const entry of dirRes.value) {
    const relPath = currentDir.length > 0 ? `${currentDir}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      if (!EXCLUDED_DIRS.has(entry.name) && !isSecretPath(relPath) && !ig.ignores(`${relPath}/`)) {
        queue.push(relPath);
      }
    } else {
      if (!isSecretPath(relPath) && !ig.ignores(relPath)) {
        files.push({ path: relPath, name: entry.name });
      }
    }
  }
  return files;
}

/**
 * Walks the backend root recursively, applying directory exclusions, secret filtering (S-30, S-31),
 * .gitignore from root, file size limits (S-122), and total size limits (S-124).
 */
export async function scanBackend(
  fs: FileSystemPort,
  root: string,
  limits: ScanLimits = {},
): Promise<ScanResult> {
  const maxFileBytes = limits.maxFileBytes ?? MIRROR_MAX_FILE_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? MIRROR_MAX_TOTAL_BYTES;

  const ig = await loadRootIgnore(fs, root);
  const queue: string[] = [''];
  const candidateFiles: CandidateFile[] = [];
  let totalBytes = 0;

  while (queue.length > 0) {
    const currentDir = queue.shift() ?? '';
    const fileEntries = await processDirectoryEntries(fs, root, currentDir, ig, queue);
    for (const entry of fileEntries) {
      const statRes = await fs.stat(root, entry.path);
      if (!statRes.ok || statRes.value.size > maxFileBytes) {
        continue;
      }
      totalBytes += statRes.value.size;
      if (totalBytes > maxTotalBytes) {
        return { kind: 'tooLarge' };
      }
      candidateFiles.push({
        path: entry.path,
        size: statRes.value.size,
        mtimeMs: statRes.value.mtimeMs,
      });
    }
  }

  return { kind: 'ok', files: candidateFiles, totalBytes };
}
