// Finds source files importing a given file or directory (SPEC-04 K3b, spec-log #70).
import { posix } from 'node:path';

import { parse } from '@babel/parser';
import { ok, type RelPath, type Result } from '@kumicraft/shared';
import type { Root } from 'postcss';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { parseStylesheet } from '../style/css-locate.ts';
import { IGNORED_DIR_NAMES } from './file-tree.ts';

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.sass',
  '.less',
]);

const JS_TS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const CSS_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less']);

export const MAX_IMPORTERS = 200;

function extractSpecifierFromNode(n: Record<string, unknown>, imports: string[]): void {
  const type = n.type;
  if (typeof type !== 'string') return;

  if (
    (type === 'ImportDeclaration' ||
      type === 'ExportNamedDeclaration' ||
      type === 'ExportAllDeclaration') &&
    typeof (n.source as Record<string, unknown> | undefined)?.value === 'string'
  ) {
    imports.push((n.source as Record<string, unknown>).value as string);
  } else if (
    type === 'CallExpression' &&
    n.callee &&
    typeof n.callee === 'object' &&
    Array.isArray(n.arguments) &&
    n.arguments[0] &&
    typeof n.arguments[0] === 'object' &&
    (n.arguments[0] as Record<string, unknown>).type === 'StringLiteral' &&
    typeof (n.arguments[0] as Record<string, unknown>).value === 'string'
  ) {
    const callee = n.callee as Record<string, unknown>;
    const argVal = (n.arguments[0] as Record<string, unknown>).value as string;
    if (callee.type === 'Import' || (callee.type === 'Identifier' && callee.name === 'require')) {
      imports.push(argVal);
    }
  }
}

function extractJsImports(code: string): string[] {
  try {
    const parsed = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    });
    const imports: string[] = [];

    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      extractSpecifierFromNode(n, imports);

      for (const key of Object.keys(n)) {
        if (key === 'loc' || key === 'tokens' || key === 'comments') continue;
        const child = n[key];
        if (Array.isArray(child)) {
          for (const item of child) visit(item);
        } else if (typeof child === 'object' && Boolean(child)) {
          visit(child);
        }
      }
    };

    visit(parsed);
    return imports;
  } catch {
    return [];
  }
}

function extractCssImports(code: string, file: string): string[] {
  try {
    const root: Root = parseStylesheet(code, file);
    const imports: string[] = [];
    root.walkAtRules((atrule) => {
      if (atrule.name === 'import' || atrule.name === 'use' || atrule.name === 'forward') {
        const match = /(?:url\(['"]?|['"])([^'")]+)['"]?/.exec(atrule.params);
        if (match?.[1]) {
          imports.push(match[1].trim());
        }
      }
    });
    return imports;
  } catch {
    return [];
  }
}

function doesSpecifierMatchTarget(
  specifier: string,
  sourceFile: string,
  targetPath: string,
  targetIsDir: boolean,
): boolean {
  let resolved: string | undefined;
  if (specifier.startsWith('@/')) {
    resolved = posix.normalize(`src/${specifier.slice(2)}`);
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    resolved = posix.normalize(posix.join(posix.dirname(sourceFile), specifier));
  } else {
    return false;
  }

  if (targetIsDir) {
    return resolved === targetPath || resolved.startsWith(`${targetPath}/`);
  }

  const sourceExt = posix.extname(sourceFile).toLowerCase();
  const targetExt = posix.extname(targetPath).toLowerCase();
  if (CSS_EXTENSIONS.has(sourceExt) && JS_TS_EXTENSIONS.has(targetExt)) {
    return false;
  }

  if (resolved === targetPath) return true;

  const targetWithoutExt = targetPath.slice(0, targetPath.length - targetExt.length);
  if (resolved === targetWithoutExt) return true;

  if (posix.basename(targetWithoutExt) === 'index') {
    const parentOfIndex = posix.dirname(targetWithoutExt);
    if (resolved === parentOfIndex) return true;
  }

  return false;
}

async function collectSourceFiles(
  fs: FileSystemPort,
  root: string,
  dir: string,
): Promise<string[]> {
  const files: string[] = [];
  const queue = [dir];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const entriesRes = await fs.readDir(root, current);
    if (!entriesRes.ok) continue;

    for (const entry of entriesRes.value) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      const child = current ? `${current}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        queue.push(child);
      } else if (SOURCE_EXTENSIONS.has(posix.extname(entry.name).toLowerCase())) {
        files.push(child);
      }
    }
  }

  return files;
}

export async function findFileImporters(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  targetPath: string,
): Promise<Result<{ importers: RelPath[]; truncated: boolean }>> {
  const dirCheck = await fs.readDir(root, targetPath);
  const targetIsDir = dirCheck.ok;

  const sourceFiles = await collectSourceFiles(fs, root, sourceDir);
  const importers: RelPath[] = [];

  for (const file of sourceFiles) {
    if (file === targetPath) continue;

    const readRes = await fs.readText(root, file);
    if (!readRes.ok) continue;

    const ext = posix.extname(file).toLowerCase();
    const specifiers = JS_TS_EXTENSIONS.has(ext)
      ? extractJsImports(readRes.value)
      : extractCssImports(readRes.value, file);

    const hasMatch = specifiers.some((spec) =>
      doesSpecifierMatchTarget(spec, file, targetPath, targetIsDir),
    );

    if (hasMatch) {
      importers.push(file);
    }
  }

  const truncated = importers.length > MAX_IMPORTERS;
  return ok({
    importers: truncated ? importers.slice(0, MAX_IMPORTERS) : importers,
    truncated,
  });
}
