// Entry point discovery and import resolution helpers for route-finder (SPEC-04 K3d).
import { posix } from 'node:path';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode } from '../source-editor/ast-helpers.ts';

const CODE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'] as const;

export async function findEntryPoint(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<string | undefined> {
  const indexHtml = await fs.readText(root, 'index.html');
  if (indexHtml.ok) {
    const match = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>/i.exec(
      indexHtml.value,
    );
    if (match?.[1]) {
      const cleaned = match[1].replace(/^\/+/, '');
      if (await fs.exists(root, cleaned)) return cleaned;
    }
  }

  for (const ext of CODE_EXTENSIONS) {
    const candidate = `${sourceDir}/main${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  for (const ext of CODE_EXTENSIONS) {
    const candidate = `${sourceDir}/index${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  for (const ext of CODE_EXTENSIONS) {
    const candidate = `${sourceDir}/routes${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  for (const ext of CODE_EXTENSIONS) {
    const candidate = `${sourceDir}/App${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  return undefined;
}

export async function resolveImportPath(
  fs: FileSystemPort,
  root: string,
  sourceFile: string,
  specifier: string,
  sourceDir: string,
): Promise<string | undefined> {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = posix.normalize(`${sourceDir}/${specifier.slice(2)}`);
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = posix.normalize(posix.join(posix.dirname(sourceFile), specifier));
  } else {
    return undefined;
  }

  if (base.split('/').includes('node_modules')) return undefined;

  if (/\.(tsx|jsx|ts|js)$/.test(base) && (await fs.exists(root, base))) {
    return base;
  }

  for (const ext of CODE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  for (const ext of CODE_EXTENSIONS) {
    const candidate = `${base}/index${ext}`;
    if (await fs.exists(root, candidate)) return candidate;
  }
  return undefined;
}

export function extractImportsFromAst(ast: AstNode): string[] {
  const imports: string[] = [];
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (
      (stmt?.type === 'ImportDeclaration' ||
        stmt?.type === 'ExportNamedDeclaration' ||
        stmt?.type === 'ExportAllDeclaration') &&
      typeof asAstNode(stmt['source'])?.['value'] === 'string'
    ) {
      imports.push(asAstNode(stmt['source'])?.['value'] as string);
    }
  }
  return imports;
}

export async function checkPackageJsonHasRouter(
  fs: FileSystemPort,
  root: string,
): Promise<boolean> {
  const readPkg = await fs.readText(root, 'package.json');
  if (!readPkg.ok) return false;
  try {
    const pkg = JSON.parse(readPkg.value) as Record<string, unknown>;
    const deps = (pkg['dependencies'] ?? {}) as Record<string, string>;
    const devDeps = (pkg['devDependencies'] ?? {}) as Record<string, string>;
    return (
      'react-router' in deps ||
      'react-router-dom' in deps ||
      'react-router' in devDeps ||
      'react-router-dom' in devDeps
    );
  } catch {
    return false;
  }
}
