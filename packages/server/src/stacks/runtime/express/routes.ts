// Static route finder for Express + Pug apps (SPEC-04 K4, Section 3.4).
import type { PageInfo, PagesInfo, RouterStatus } from '@kumicraft/shared';

import { asAstNode, type AstNode, isAstNode, parseJsxAst } from '../../../lib/ast-helpers.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

type ParsedRoute = {
  readonly path: string;
  readonly file?: string | undefined;
  readonly dynamic: boolean;
};

type FileAnalysis = {
  readonly routes: readonly ParsedRoute[];
  readonly mountedRouters: readonly { readonly prefix: string; readonly targetFile: string }[];
};

function stringLiteralValue(node: AstNode | undefined): string | undefined {
  if (node?.type === 'StringLiteral' && typeof node['value'] === 'string') {
    return node['value'];
  }
  return undefined;
}

function findRenderView(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRenderView(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isAstNode(node)) return undefined;

  if (node.type === 'CallExpression') {
    const callee = asAstNode(node['callee']);
    const prop = asAstNode(callee?.['property']);
    if (prop?.type === 'Identifier' && prop['name'] === 'render') {
      const args: unknown[] = Array.isArray(node['arguments']) ? node['arguments'] : [];
      const firstArg = asAstNode(args[0]);
      const view = stringLiteralValue(firstArg);
      if (view !== undefined) return view;
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key !== 'loc' && key !== 'leadingComments' && key !== 'trailingComments') {
      const found = findRenderView(value);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function joinExpressPath(prefix: string, route: string): string {
  const p = prefix.replace(/\/+$/, '');
  const r = route.replace(/^\/+/, '');
  if (p === '' && r === '') return '/';
  if (p === '') return `/${r}`;
  if (r === '') return p.startsWith('/') ? p : `/${p}`;
  const combined = `${p}/${r}`.replace(/\/+/g, '/');
  return combined.startsWith('/') ? combined : `/${combined}`;
}

function resolveViewPath(viewsDir: string, viewName: string | undefined): string | undefined {
  if (viewName === undefined) return undefined;
  const cleanViews = viewsDir.replaceAll('\\', '/').replace(/\/+$/, '');
  const fileWithExt = viewName.endsWith('.pug') ? viewName : `${viewName}.pug`;
  return `${cleanViews}/${fileWithExt}`.replace(/\/+/g, '/');
}

function extractRequireTarget(node: AstNode | undefined): string | undefined {
  if (node?.type !== 'CallExpression') return undefined;
  const callee = asAstNode(node['callee']);
  if (callee?.type === 'Identifier' && callee['name'] === 'require') {
    const args: unknown[] = Array.isArray(node['arguments']) ? node['arguments'] : [];
    return stringLiteralValue(asAstNode(args[0]));
  }
  return undefined;
}

function collectRequires(body: readonly unknown[]): Map<string, string> {
  const requires = new Map<string, string>();
  for (const raw of body) {
    const stmt = asAstNode(raw);
    if (stmt?.type === 'VariableDeclaration') {
      const decls: unknown[] = Array.isArray(stmt['declarations']) ? stmt['declarations'] : [];
      for (const d of decls) {
        const decl = asAstNode(d);
        const id = asAstNode(decl?.['id']);
        const init = asAstNode(decl?.['init']);
        const target = extractRequireTarget(init);
        if (id?.type === 'Identifier' && typeof id['name'] === 'string' && target !== undefined) {
          requires.set(id['name'], target);
        }
      }
    }
  }
  return requires;
}

async function resolveModulePath(
  fs: FileSystemPort,
  root: string,
  baseFile: string,
  specifier: string,
): Promise<string | undefined> {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return undefined;
  }
  const baseDir = baseFile.includes('/') ? baseFile.slice(0, baseFile.lastIndexOf('/')) : '';
  const rawPath = baseDir === '' ? specifier.replace(/^\.\//, '') : `${baseDir}/${specifier}`;
  const normalized = rawPath.replaceAll('\\', '/');

  const exts = ['', '.js', '.cjs', '.mjs', '/index.js', '/index.cjs', '/index.mjs'];
  for (const ext of exts) {
    const candidate = `${normalized}${ext}`.replace(/\/{2,}/g, '/');
    if (await fs.exists(root, candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function inspectCall(
  call: AstNode,
  requires: Map<string, string>,
  viewsDir: string,
  routes: ParsedRoute[],
  mounts: { readonly prefix: string; readonly targetFile: string }[],
): void {
  const callee = asAstNode(call['callee']);
  const prop = asAstNode(callee?.['property']);
  const method = prop?.type === 'Identifier' ? prop['name'] : undefined;
  const args: unknown[] = Array.isArray(call['arguments']) ? call['arguments'] : [];

  if (method === 'get') {
    const routePath = stringLiteralValue(asAstNode(args[0]));
    if (routePath !== undefined) {
      const viewName = findRenderView(args.slice(1));
      const file = resolveViewPath(viewsDir, viewName);
      routes.push({ path: routePath, file, dynamic: routePath.includes(':') });
    }
  } else if (method === 'use') {
    const prefix = stringLiteralValue(asAstNode(args[0]));
    const targetExpr = asAstNode(args[1]);
    const required =
      targetExpr?.type === 'Identifier' && typeof targetExpr['name'] === 'string'
        ? requires.get(targetExpr['name'])
        : extractRequireTarget(targetExpr);
    if (prefix !== undefined && required !== undefined) {
      mounts.push({ prefix, targetFile: required });
    }
  }
}

function analyzeAst(ast: AstNode, viewsDir: string): FileAnalysis {
  const routes: ParsedRoute[] = [];
  const mounts: { readonly prefix: string; readonly targetFile: string }[] = [];
  const program = asAstNode(ast['program']);
  const body: readonly unknown[] = Array.isArray(program?.['body']) ? program['body'] : [];
  const requires = collectRequires(body);

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isAstNode(node)) return;
    if (node.type === 'CallExpression') {
      inspectCall(node, requires, viewsDir, routes, mounts);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'loc' && key !== 'leadingComments' && key !== 'trailingComments') {
        walk(value);
      }
    }
  }

  walk(program);
  return { routes, mountedRouters: mounts };
}

async function parseFileRoutes(
  fs: FileSystemPort,
  root: string,
  file: string,
  viewsDir: string,
): Promise<FileAnalysis | undefined> {
  const read = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
  if (!read.ok) return undefined;
  try {
    const ast = parseJsxAst(read.value);
    return analyzeAst(ast, viewsDir);
  } catch {
    return undefined;
  }
}

async function collectAllRoutes(
  fs: FileSystemPort,
  root: string,
  entryFile: string,
  viewsDir: string,
): Promise<PageInfo[]> {
  const pages: PageInfo[] = [];
  const seenPaths = new Set<string>();
  const visited = new Set<string>();

  async function traverse(currentFile: string, prefix: string): Promise<void> {
    if (visited.has(currentFile)) return;
    visited.add(currentFile);

    const analysis = await parseFileRoutes(fs, root, currentFile, viewsDir);
    if (analysis === undefined) return;

    for (const r of analysis.routes) {
      const fullPath = joinExpressPath(prefix, r.path);
      if (!seenPaths.has(fullPath)) {
        seenPaths.add(fullPath);
        pages.push({
          path: fullPath,
          ...(r.file !== undefined ? { file: r.file } : {}),
          dynamic: fullPath.includes(':'),
        });
      }
    }

    for (const mount of analysis.mountedRouters) {
      const resolved = await resolveModulePath(fs, root, currentFile, mount.targetFile);
      if (resolved !== undefined) {
        await traverse(resolved, joinExpressPath(prefix, mount.prefix));
      }
    }
  }

  await traverse(entryFile, '');
  return pages;
}

export async function findExpressRoutes(
  fs: FileSystemPort,
  root: string,
  serverEntry: string,
  viewsDir: string,
): Promise<PagesInfo> {
  const pages = await collectAllRoutes(fs, root, serverEntry, viewsDir);
  const hasRoutes = pages.length > 0;

  const router: RouterStatus = hasRoutes
    ? {
        status: 'found',
        file: serverEntry,
        line: 1,
        kind: 'express',
        chosen: true,
      }
    : {
        status: 'none',
        hasRouterPackage: true,
      };

  return {
    convention: hasRoutes,
    ...(hasRoutes ? { routesFile: serverEntry } : {}),
    router,
    pages,
  };
}
