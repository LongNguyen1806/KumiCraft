// QC-06: tests never touch fixtures/ directly. They work on a copy in a fresh temporary folder.
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const FIXTURES_DIR = join(REPO_ROOT, 'fixtures');

export type TempDir = {
  readonly path: string;
  readonly remove: () => Promise<void>;
};

/** Creates an empty temporary folder whose name starts with `reactcraft-<label>-`. */
export async function makeTempDir(label: string): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), `reactcraft-${label}-`));
  return { path, remove: () => rm(path, { recursive: true, force: true }) };
}

/**
 * Copies `fixtures/<name>` (for example `projects/vite8-react19-ts`) into a new temporary
 * folder and returns that copy.
 */
export async function copyFixture(name: string): Promise<TempDir> {
  const target = await makeTempDir(name.replaceAll(/[\\/]/g, '-'));
  await cp(join(FIXTURES_DIR, name), target.path, { recursive: true });
  return target;
}
