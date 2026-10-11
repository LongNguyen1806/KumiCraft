// Locations the CLI needs at run time, both from source (development) and from the bundle.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Finds the built Studio: `dist/studio` next to the bundled CLI, or `packages/studio/dist` when the
 * CLI runs from source. Returns undefined when the Studio has not been built.
 */
export function findStudioDir(): string | undefined {
  const candidates = [join(here, 'studio'), join(here, '..', '..', 'studio', 'dist')];
  return candidates.find((dir) => existsSync(join(dir, 'index.html')));
}
