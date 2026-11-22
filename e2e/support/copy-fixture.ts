// QC-06: tests never touch fixtures/ directly. They work on a copy in a fresh temporary folder.
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const FIXTURES_DIR = join(REPO_ROOT, 'fixtures');
/** The fixture projects have no install of their own; the Studio has Vite, React and Tailwind. */
const STUDIO_NODE_MODULES = join(REPO_ROOT, 'packages', 'studio', 'node_modules');
/** Packages only some fixtures use (styling R-ST-02, router K3d), installed at the repo root. */
const EXTRA_PACKAGES = [
  'bootstrap',
  'sass',
  'less',
  'react-router',
  'express',
  'pug',
  'compression',
  'helmet',
  'typescript',
] as const;

export type TempDir = {
  readonly path: string;
  readonly remove: () => Promise<void>;
};

/**
 * Creates an empty temporary folder whose name starts with `kumicraft-<label>-`. Removing it
 * retries while Windows still holds a file: a stopped session's runner closes Vite on its own
 * after the CLI is gone, which can take a moment.
 */
export async function makeTempDir(label: string, parent: string = tmpdir()): Promise<TempDir> {
  await mkdir(parent, { recursive: true });
  const path = await mkdtemp(join(parent, `kumicraft-${label}-`));
  return {
    path,
    remove: () => rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }),
  };
}

/**
 * Gives the copy its own node_modules folder whose packages link to the source's. Vite keeps its
 * caches in `<project>/node_modules/.vite*`, so each copy gets its own instead of all dev servers
 * of a test run sharing (and racing on) the source's.
 */
async function linkPackages(sourceModules: string, target: string): Promise<void> {
  const own = join(target, 'node_modules');
  await mkdir(own);
  for (const entry of await readdir(sourceModules, { withFileTypes: true })) {
    if (entry.name.startsWith('.vite') || entry.isFile()) continue;
    await symlink(join(sourceModules, entry.name), join(own, entry.name), 'junction');
  }
}

/**
 * Files a run leaves in a fixture opened in a developer's own KumiCraft (`pnpm dev`): its packages,
 * the Next.js cache and the session lock. Copying the lock makes the test's session refuse to open.
 */
function isLeftByARun(source: string): boolean {
  const parts = source.split(/[\\/]/);
  return (
    parts.includes('node_modules') ||
    parts.includes('.next') ||
    (parts.at(-2) === '.kumicraft' && parts.at(-1) === 'lock')
  );
}

/**
 * Copies `fixtures/<name>` (for example `projects/vite8-react19-ts`) into a new temporary
 * folder and returns that copy (R-QA-01).
 *
 * `insideRepo`: the copy goes under `<repo>/.e2e-tmp/`. Next.js needs its packages inside the
 * project's workspace root (found from the nearest lockfile) and on the same drive: in the system
 * temp folder its links point outside both, as in no real project (03b section 1.6).
 */
export async function copyFixture(
  name: string,
  options: { readonly insideRepo?: boolean } = {},
): Promise<TempDir> {
  const parent = options.insideRepo === true ? join(REPO_ROOT, '.e2e-tmp') : tmpdir();
  const target = await makeTempDir(name.replaceAll(/[\\/]/g, '-'), parent);
  await cp(join(FIXTURES_DIR, name), target.path, {
    recursive: true,
    filter: (source) => !isLeftByARun(source),
  });
  const fixtureModules = join(FIXTURES_DIR, name, 'node_modules');
  const sourceModules = existsSync(fixtureModules) ? fixtureModules : STUDIO_NODE_MODULES;
  if (existsSync(sourceModules)) await linkPackages(sourceModules, target.path);
  for (const pkg of EXTRA_PACKAGES) {
    const source = join(REPO_ROOT, 'node_modules', pkg);
    const link = join(target.path, 'node_modules', pkg);
    if (existsSync(source) && !existsSync(link)) await symlink(source, link, 'junction');
  }
  return target;
}
