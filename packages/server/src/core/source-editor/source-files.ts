// Source files of the project for external AI agents (R-AG-19, round 7b): which pages, components
// and style files exist, so an agent never has to guess a file name.
import { ok, type Result } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

export const SOURCE_FILES_MAX = 2000;
const MAX_DEPTH = 12;
const LISTED_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.css', '.scss', '.sass', '.less'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build']);

export type SourceFiles = { readonly files: readonly string[]; readonly truncated: boolean };

type Scan = { readonly files: string[]; truncated: boolean };

async function scan(
  fs: FileSystemPort,
  root: string,
  dir: string,
  depth: number,
  state: Scan,
): Promise<void> {
  if (depth > MAX_DEPTH) return;
  const read = await fs.readDir(root, dir);
  if (!read.ok) return;
  const entries = [...read.value].sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      await scan(fs, root, path, depth + 1, state);
    } else if (LISTED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      if (state.files.length >= SOURCE_FILES_MAX) {
        state.truncated = true;
        return;
      }
      state.files.push(path);
    }
    if (state.truncated) return;
  }
}

/** Code and style files under the source folder, sorted, at most {@link SOURCE_FILES_MAX}. */
export async function listSourceFiles(
  fs: FileSystemPort,
  projectRoot: string,
  sourceDir: string,
): Promise<Result<SourceFiles>> {
  const state: Scan = { files: [], truncated: false };
  await scan(fs, projectRoot, sourceDir.replaceAll('\\', '/').replace(/\/+$/, ''), 0, state);
  return ok({ files: state.files, truncated: state.truncated });
}
