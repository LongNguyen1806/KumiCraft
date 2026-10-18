// How many places of the project use a component (R-SE-14, FR-14): JSX tags of the component in its
// own file, plus JSX tags of every file that imports it (relative path or the `@/` alias of
// tsconfig.json), under whatever local name the import gives it.
import { createHash } from 'node:crypto';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode, parseJsxAst } from './ast-helpers.ts';

const MAX_FILES = 2000;
const MAX_FILE_BYTES = 1024 * 1024;
const RESOLVE_SUFFIXES = ['', '.tsx', '.jsx', '.ts', '.js', '/index.tsx', '/index.jsx'] as const;

type ImportBinding = { readonly source: string; readonly imported: string; readonly local: string };

/** What one file imports, exports and renders, from its syntax tree. */
type FileSummary = {
  readonly imports: readonly ImportBinding[];
  readonly jsxCounts: ReadonlyMap<string, number>;
  /** Local names exported under their own name, and the local name of the default export. */
  readonly exported: ReadonlySet<string>;
  readonly defaultLocal?: string | undefined;
};

export type UsageCounter = {
  count(projectRoot: string, sourceDir: string, file: string, component: string): Promise<number>;
};

const hashOf = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const nameOf = (node: unknown): string | undefined => {
  const value = asAstNode(node)?.['name'];
  return typeof value === 'string' ? value : undefined;
};

function walk(node: unknown, visit: (n: AstNode) => void): void {
  const ast = asAstNode(node);
  if (ast === undefined) {
    if (Array.isArray(node)) for (const child of node) walk(child, visit);
    return;
  }
  visit(ast);
  for (const [key, child] of Object.entries(ast)) {
    if (key !== 'loc' && key !== 'tokens' && key !== 'comments' && typeof child === 'object') {
      walk(child, visit);
    }
  }
}

function importsOf(node: AstNode): ImportBinding[] {
  const source = asAstNode(node['source'])?.['value'];
  const specifiers = Array.isArray(node['specifiers']) ? node['specifiers'] : [];
  if (typeof source !== 'string') return [];
  return specifiers.flatMap((spec) => {
    const s = asAstNode(spec);
    const local = nameOf(s?.['local']);
    if (s === undefined || local === undefined) return [];
    if (s.type === 'ImportDefaultSpecifier') return [{ source, imported: 'default', local }];
    const imported = nameOf(s['imported']);
    return imported === undefined ? [] : [{ source, imported, local }];
  });
}

function exportedNames(node: AstNode): string[] {
  if (node['exportKind'] === 'type') return [];
  const declaration = asAstNode(node['declaration']);
  if (
    declaration?.type === 'TSTypeAliasDeclaration' ||
    declaration?.type === 'TSInterfaceDeclaration'
  ) {
    return [];
  }
  const declared = nameOf(declaration?.['id']);
  if (declared !== undefined) return [declared];
  const declarators = Array.isArray(declaration?.['declarations'])
    ? declaration['declarations']
    : [];
  const specifiers = Array.isArray(node['specifiers']) ? node['specifiers'] : [];
  return [
    ...declarators.map((d) => nameOf(asAstNode(d)?.['id'])),
    ...specifiers
      .filter((s) => asAstNode(s)?.['exportKind'] !== 'type')
      .map((s) => nameOf(asAstNode(s)?.['local'])),
  ].filter((name): name is string => name !== undefined);
}

export function summarize(code: string): FileSummary | undefined {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return undefined; // A file that does not parse uses nothing; Vite reports its error.
  }
  const imports: ImportBinding[] = [];
  const jsxCounts = new Map<string, number>();
  const exported = new Set<string>();
  let defaultLocal: string | undefined;
  walk(ast['program'], (node) => {
    if (node.type === 'ImportDeclaration') imports.push(...importsOf(node));
    if (node.type === 'ExportNamedDeclaration')
      for (const n of exportedNames(node)) exported.add(n);
    if (node.type === 'ExportDefaultDeclaration') {
      const declaration = asAstNode(node['declaration']);
      defaultLocal = nameOf(declaration?.['id']) ?? nameOf(declaration);
    }
    if (node.type === 'JSXOpeningElement') {
      const tag =
        asAstNode(node['name'])?.type === 'JSXIdentifier' ? nameOf(node['name']) : undefined;
      if (tag !== undefined) jsxCounts.set(tag, (jsxCounts.get(tag) ?? 0) + 1);
    }
  });
  return { imports, jsxCounts, exported, defaultLocal };
}

/** `@/*` → target prefix from tsconfig.json `compilerOptions.paths`, without comments. */
export async function readAliasPrefix(
  fs: FileSystemPort,
  root: string,
): Promise<string | undefined> {
  const read = await fs.readText(root, 'tsconfig.json', { maxBytes: MAX_FILE_BYTES });
  if (!read.ok) return undefined;
  const withoutComments = read.value.replace(/\/\*[\s\S]*?\*\/|(^|[^:"])\/\/.*$/gm, '$1');
  try {
    const config = JSON.parse(withoutComments) as {
      compilerOptions?: { paths?: Record<string, readonly string[]> };
    };
    const target = config.compilerOptions?.paths?.['@/*']?.[0];
    return target?.replace(/^\.\//, '').replace(/\*$/, '');
  } catch {
    return undefined; // tsconfig with trailing commas: the alias is simply not followed.
  }
}

function normalizePosix(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return parts.join('/');
}

/** Project-relative candidates an import source may point to (without extension or index). */
function importBase(
  importer: string,
  source: string,
  alias: string | undefined,
): string | undefined {
  if (source.startsWith('./') || source.startsWith('../')) {
    const dir = importer.split('/').slice(0, -1).join('/');
    return normalizePosix(`${dir}/${source}`);
  }
  if (alias !== undefined && source.startsWith('@/')) {
    return normalizePosix(`${alias}${source.slice(2)}`);
  }
  return undefined;
}

export async function listSourceFiles(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<string[]> {
  const files: string[] = [];
  const pending = [sourceDir];
  while (pending.length > 0 && files.length < MAX_FILES) {
    const dir = pending.shift() ?? '';
    const entries = await fs.readDir(root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      const path = `${dir}/${entry.name}`;
      if (
        entry.kind === 'directory' &&
        entry.name !== 'node_modules' &&
        !entry.name.startsWith('.')
      ) {
        pending.push(path);
      } else if (entry.kind === 'file' && /\.(tsx|jsx)$/.test(entry.name)) {
        files.push(path);
      }
    }
  }
  return files;
}

export function createUsageCounter(fs: FileSystemPort): UsageCounter {
  const cache = new Map<string, { readonly hash: string; readonly summary?: FileSummary }>();

  const summaryOf = async (root: string, file: string): Promise<FileSummary | undefined> => {
    const read = await fs.readText(root, file, { maxBytes: MAX_FILE_BYTES });
    if (!read.ok) return undefined;
    const key = `${root}:${file}`;
    const hash = hashOf(read.value);
    const cached = cache.get(key);
    if (cached?.hash === hash) return cached.summary;
    const summary = summarize(read.value);
    cache.set(key, summary === undefined ? { hash } : { hash, summary });
    return summary;
  };

  return {
    async count(root, sourceDir, file, component) {
      const own = await summaryOf(root, file);
      const isDefault = own?.defaultLocal === component;
      const isNamed = own?.exported.has(component) === true;
      let total = own?.jsxCounts.get(component) ?? 0;
      if (!isDefault && !isNamed) return total;

      const alias = await readAliasPrefix(fs, root);
      const targets = new Set(
        RESOLVE_SUFFIXES.map((suffix) => `${file.replace(/\.(tsx|jsx)$/, '')}${suffix}`),
      );
      targets.add(file);
      if (/\/index\.(tsx|jsx)$/.test(file)) targets.add(file.replace(/\/index\.(tsx|jsx)$/, ''));
      for (const other of await listSourceFiles(fs, root, sourceDir)) {
        if (other === file) continue;
        const summary = await summaryOf(root, other);
        for (const binding of summary?.imports ?? []) {
          const base = importBase(other, binding.source, alias);
          const matchesFile = base !== undefined && targets.has(base);
          const matchesName =
            binding.imported === 'default' ? isDefault : binding.imported === component;
          if (matchesFile && matchesName) total += summary?.jsxCounts.get(binding.local) ?? 0;
        }
      }
      return total;
    },
  };
}
