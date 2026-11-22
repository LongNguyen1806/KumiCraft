// Which tsconfig files the build check passes to `tsc -p` (SPEC-04 M-BC). A Vite template's root
// `tsconfig.json` has `"files": []` and `references` (app, node): checking it checks nothing, so
// each referenced config is checked instead, with `--noEmit` (no `tsc -b`, which writes files).
import type { FileSystemPort } from '../../ports/file-system-port.ts';

const MAX_CONFIGS = 8;
/** `"path": "./tsconfig.app.json"` entries; tsconfig is JSON with comments, so no JSON.parse. */
const REFERENCE_PATH = /"path"\s*:\s*"([^"\n]{1,200})"/g;

function cleanRel(path: string): string {
  return path
    .replaceAll('\\', '/')
    .replace(/^(\.\/)+/, '')
    .replace(/\/+$/, '');
}

async function configFile(
  fs: FileSystemPort,
  root: string,
  ref: string,
): Promise<string | undefined> {
  const rel = cleanRel(ref);
  if (rel === '' || rel.split('/').includes('..')) return undefined;
  if (rel.endsWith('.json')) return (await fs.exists(root, rel)) ? rel : undefined;
  const inner = `${rel}/tsconfig.json`;
  return (await fs.exists(root, inner)) ? inner : undefined;
}

export async function tsconfigsToCheck(fs: FileSystemPort, root: string): Promise<string[]> {
  if (!(await fs.exists(root, 'tsconfig.json'))) return [];
  const read = await fs.readText(root, 'tsconfig.json');
  if (!read.ok) return ['tsconfig.json'];
  const text = read.value.slice(0, 200_000);
  if (!/"references"\s*:/.test(text)) return ['tsconfig.json'];
  const refs: string[] = [];
  for (const match of text.matchAll(REFERENCE_PATH)) {
    const file = await configFile(fs, root, match[1] ?? '');
    if (file !== undefined && !refs.includes(file)) refs.push(file);
    if (refs.length >= MAX_CONFIGS) break;
  }
  // References and own files: the root config checks its own `include` too.
  const ownFiles = !/"files"\s*:\s*\[\s*\]/.test(text);
  return ownFiles ? ['tsconfig.json', ...refs] : refs;
}
