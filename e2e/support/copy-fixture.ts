// QC-06: tests never touch fixtures/ directly. They work on a copy in a fresh temporary folder.
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const FIXTURES_DIR = join(REPO_ROOT, 'fixtures');
/** The fixture projects have no install of their own; the Studio has Vite, React and Tailwind. */
const STUDIO_NODE_MODULES = join(REPO_ROOT, 'packages', 'studio', 'node_modules');

export type TempDir = {
  readonly path: string;
  readonly remove: () => Promise<void>;
};

/**
 * Creates an empty temporary folder whose name starts with `reactcraft-<label>-`. Removing it
 * retries while Windows still holds a file: a stopped session's runner closes Vite on its own
 * after the CLI is gone, which can take a moment.
 */
export async function makeTempDir(label: string): Promise<TempDir> {
  const path = await mkdtemp(join(tmpdir(), `reactcraft-${label}-`));
  return {
    path,
    remove: () => rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
  };
}

/**
 * Gives the copy its own node_modules folder whose packages link to the Studio's. Vite keeps its
 * caches in `<project>/node_modules/.vite*`, so each copy gets its own instead of all dev servers
 * of a test run sharing (and racing on) the Studio's.
 */
async function linkStudioPackages(target: string): Promise<void> {
  const own = join(target, 'node_modules');
  await mkdir(own);
  for (const entry of await readdir(STUDIO_NODE_MODULES, { withFileTypes: true })) {
    if (entry.name.startsWith('.vite') || entry.isFile()) continue;
    await symlink(join(STUDIO_NODE_MODULES, entry.name), join(own, entry.name), 'junction');
  }
}

/**
 * Copies `fixtures/<name>` (for example `projects/vite8-react19-ts`) into a new temporary
 * folder and returns that copy (R-QA-01).
 */
export async function copyFixture(name: string): Promise<TempDir> {
  const target = await makeTempDir(name.replaceAll(/[\\/]/g, '-'));
  await cp(join(FIXTURES_DIR, name), target.path, {
    recursive: true,
    filter: (source) => !source.includes('node_modules'),
  });
  if (existsSync(STUDIO_NODE_MODULES)) await linkStudioPackages(target.path);
  return target;
}
