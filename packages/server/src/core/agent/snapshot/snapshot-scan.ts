// Recursive project directory scanner for snapshots (S-31, S-113, ADR-BE-33).
import type { Ignore } from 'ignore';

import { isBinaryFile, loadRootIgnore } from '../../mirror/mirror-scan.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { isSecretPath } from '../../shared/secret-paths.ts';
import { SNAPSHOT_EXCLUDED_DIRS } from './snapshot-types.ts';

export { isBinaryFile };

export type ScannedFile = {
  readonly path: string;
  readonly size: number;
  readonly mtimeMs: number;
};

const EXCLUDED_DIRS = new Set<string>(SNAPSHOT_EXCLUDED_DIRS);

async function processDir(
  fs: FileSystemPort,
  projectRoot: string,
  currentDir: string,
  ig: Ignore,
  queue: string[],
): Promise<readonly string[]> {
  const dirRes = await fs.readDir(projectRoot, currentDir);
  if (!dirRes.ok) {
    return [];
  }
  const files: string[] = [];
  for (const entry of dirRes.value) {
    const relPath = currentDir.length > 0 ? `${currentDir}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      if (!EXCLUDED_DIRS.has(entry.name) && !isSecretPath(relPath) && !ig.ignores(`${relPath}/`)) {
        queue.push(relPath);
      }
    } else {
      if (!isSecretPath(relPath) && !ig.ignores(relPath)) {
        files.push(relPath);
      }
    }
  }
  return files;
}

/**
 * Recursively scans project root, ignoring secrets (S-31), excluded dirs, and root gitignore.
 */
export async function scanProject(
  fs: FileSystemPort,
  projectRoot: string,
): Promise<readonly ScannedFile[]> {
  const ig = await loadRootIgnore(fs, projectRoot);
  const queue: string[] = [''];
  const scanned: ScannedFile[] = [];

  while (queue.length > 0) {
    const currentDir = queue.shift() ?? '';
    const filePaths = await processDir(fs, projectRoot, currentDir, ig, queue);
    for (const filePath of filePaths) {
      const statRes = await fs.stat(projectRoot, filePath);
      if (statRes.ok) {
        scanned.push({
          path: filePath,
          size: statRes.value.size,
          mtimeMs: statRes.value.mtimeMs,
        });
      }
    }
  }

  return scanned;
}
