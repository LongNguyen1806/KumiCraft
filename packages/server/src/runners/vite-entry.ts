// Where the project's Vite Node API is (round 1 of 04-lo-trinh.md): its ES module build.
// `require.resolve('vite')` follows the `require` condition, which Vite 5 maps to a CommonJS
// wrapper the runner cannot use ("Invalid Vite module"); Vite 6 is saved only by `module-sync`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The file an `exports` entry gives to `import`: a string, or `{ import }`, or `{ default }`. */
function importTarget(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return undefined;
  if ('import' in entry) return importTarget(entry.import);
  if ('default' in entry) return importTarget(entry.default);
  return undefined;
}

function dotExport(pkg: unknown): unknown {
  if (!pkg || typeof pkg !== 'object' || !('exports' in pkg)) return undefined;
  const field = pkg.exports;
  if (typeof field === 'string') return field;
  return field && typeof field === 'object' && '.' in field ? field['.'] : undefined;
}

/** The absolute path of the project's Vite ES module entry, found from the project's folder. */
export function resolveViteEntry(require: NodeJS.Require): string {
  const pkgPath = require.resolve('vite/package.json');
  const pkg: unknown = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const target = importTarget(dotExport(pkg));
  return target === undefined ? require.resolve('vite') : join(dirname(pkgPath), target);
}
