// Route finder: locates router declarations across the project (SPEC-04 K3d, spec-log #74).
import type { RouterKind, RouterStatus } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import {
  checkPackageJsonHasRouter,
  extractImportsFromAst,
  findEntryPoint,
  resolveImportPath,
} from './route-resolve.ts';

const MAX_TRAVERSAL_FILES = 200;
const MAX_TRAVERSAL_DEPTH = 20;

const ROUTER_CALLS = new Set([
  'createBrowserRouter',
  'createHashRouter',
  'createMemoryRouter',
  'useRoutes',
]);

type DiscoveredRouter = {
  readonly file: string;
  readonly line: number;
  readonly kind: RouterKind;
  /** Only exports a route array: a module of a real router unless no router call exists. */
  readonly moduleOnly?: boolean;
};

type DiscoveredUnsupported = {
  readonly file: string;
  readonly reason: 'generated' | 'noRoutes' | 'parseError';
};

function hasRouteChild(element: AstNode): boolean {
  const children: unknown[] = Array.isArray(element['children']) ? element['children'] : [];
  for (const raw of children) {
    const child = asAstNode(raw);
    if (!child || child.type !== 'JSXElement') continue;
    const opening = asAstNode(child['openingElement']);
    const name = asAstNode(opening?.['name']);
    if (name?.type === 'JSXIdentifier' && name['name'] === 'Route') return true;
    if (hasRouteChild(child)) return true;
  }
  return false;
}

function findJsxRoutesElement(ast: AstNode): { element: AstNode; hasRoutes: boolean } | undefined {
  let found: { element: AstNode; hasRoutes: boolean } | undefined;
  function search(node: unknown): void {
    if (found || !node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (n.type === 'JSXElement') {
      const opening = asAstNode(n['openingElement']);
      const name = asAstNode(opening?.['name']);
      if (name?.type === 'JSXIdentifier' && name['name'] === 'Routes') {
        found = { element: n, hasRoutes: hasRouteChild(n) };
        return;
      }
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') search(v);
    }
  }
  search(ast);
  return found;
}

function isLiteralArray(arrayNode: AstNode): { ok: boolean; reason?: 'generated' | 'noRoutes' } {
  const elements: unknown[] = Array.isArray(arrayNode['elements']) ? arrayNode['elements'] : [];
  if (elements.length === 0) return { ok: false, reason: 'noRoutes' };
  for (const raw of elements) {
    const el = asAstNode(raw);
    if (!el) continue;
    if (el.type === 'SpreadElement') {
      const arg = asAstNode(el['argument']);
      if (arg?.type !== 'ArrayExpression') return { ok: false, reason: 'generated' };
    } else if (el.type !== 'ObjectExpression') {
      return { ok: false, reason: 'generated' };
    }
  }
  return { ok: true };
}

function findImportedSymbolFile(ast: AstNode, symbolName: string): string | undefined {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    for (const raw of specifiers) {
      const spec = asAstNode(raw);
      const local = asAstNode(spec?.['local']);
      if (local?.['name'] === symbolName) {
        const sourceNode = asAstNode(stmt['source']);
        return typeof sourceNode?.['value'] === 'string' ? sourceNode['value'] : undefined;
      }
    }
  }
  return undefined;
}

function findLocalVarInit(ast: AstNode, varName: string): AstNode | undefined {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'VariableDeclaration') {
      const decls = Array.isArray(stmt['declarations']) ? stmt['declarations'] : [];
      for (const raw of decls) {
        const decl = asAstNode(raw);
        const id = asAstNode(decl?.['id']);
        if (id?.['name'] === varName) return asAstNode(decl?.['init']);
      }
    }
  }
  return undefined;
}

function findExportedArrayNode(ast: AstNode, exportName?: string): AstNode | undefined {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ExportNamedDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'VariableDeclaration') {
        const decls = Array.isArray(decl['declarations']) ? decl['declarations'] : [];
        for (const raw of decls) {
          const d = asAstNode(raw);
          const id = asAstNode(d?.['id']);
          if (!exportName || id?.['name'] === exportName) return asAstNode(d?.['init']);
        }
      }
    } else if (stmt?.type === 'ExportDefaultDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'ArrayExpression') return decl;
    }
  }
  return undefined;
}

async function inspectImportedRouteArray(
  fs: FileSystemPort,
  root: string,
  sourceFile: string,
  specifier: string,
  sourceDir: string,
  symbolName: string,
): Promise<{ router?: DiscoveredRouter; unsupported?: DiscoveredUnsupported }> {
  const resolved = await resolveImportPath(fs, root, sourceFile, specifier, sourceDir);
  if (!resolved) return {};
  const read = await fs.readText(root, resolved);
  if (!read.ok) return {};
  let ast: AstNode;
  try {
    ast = parseJsxAst(read.value);
  } catch {
    return { unsupported: { file: resolved, reason: 'parseError' } };
  }

  const arrayInit = findLocalVarInit(ast, symbolName) ?? findExportedArrayNode(ast, symbolName);
  if (!arrayInit) return {};
  if (arrayInit.type !== 'ArrayExpression') {
    return { unsupported: { file: resolved, reason: 'generated' } };
  }
  const check = isLiteralArray(arrayInit);
  if (!check.ok) {
    return { unsupported: { file: resolved, reason: check.reason ?? 'generated' } };
  }
  const line = typeof arrayInit.loc?.start?.line === 'number' ? arrayInit.loc.start.line : 1;
  return { router: { file: resolved, line, kind: 'dataRouter' } };
}

async function inspectDataRouterCall(
  callNode: AstNode,
  ast: AstNode,
  file: string,
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<{ router?: DiscoveredRouter; unsupported?: DiscoveredUnsupported }> {
  const args: unknown[] = Array.isArray(callNode['arguments']) ? callNode['arguments'] : [];
  const first = asAstNode(args[0]);
  if (!first) return { unsupported: { file, reason: 'noRoutes' } };

  if (first.type === 'ArrayExpression') {
    const check = isLiteralArray(first);
    if (!check.ok) return { unsupported: { file, reason: check.reason ?? 'generated' } };
    const line = typeof callNode.loc?.start?.line === 'number' ? callNode.loc.start.line : 1;
    return { router: { file, line, kind: 'dataRouter' } };
  }

  if (first.type === 'Identifier') {
    const varName = first['name'] as string;
    const localInit = findLocalVarInit(ast, varName);
    if (localInit) {
      if (localInit.type !== 'ArrayExpression') {
        return { unsupported: { file, reason: 'generated' } };
      }
      const check = isLiteralArray(localInit);
      if (!check.ok) return { unsupported: { file, reason: check.reason ?? 'generated' } };
      const line = typeof localInit.loc?.start?.line === 'number' ? localInit.loc.start.line : 1;
      return { router: { file, line, kind: 'dataRouter' } };
    }

    const importSpec = findImportedSymbolFile(ast, varName);
    if (importSpec) {
      return inspectImportedRouteArray(fs, root, file, importSpec, sourceDir, varName);
    }
  }

  return { unsupported: { file, reason: 'generated' } };
}

function findRouterCalls(ast: AstNode): AstNode[] {
  const calls: AstNode[] = [];
  function search(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (n.type === 'CallExpression') {
      const callee = asAstNode(n['callee']);
      if (typeof callee?.['name'] === 'string' && ROUTER_CALLS.has(callee['name'])) {
        calls.push(n);
      }
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') search(v);
    }
  }
  search(ast);
  return calls;
}

export async function inspectFileForRouter(
  fs: FileSystemPort,
  root: string,
  file: string,
  sourceDir: string,
): Promise<{ router?: DiscoveredRouter; unsupported?: DiscoveredUnsupported }> {
  const read = await fs.readText(root, file);
  if (!read.ok) return {};
  let ast: AstNode;
  try {
    ast = parseJsxAst(read.value);
  } catch {
    return { unsupported: { file, reason: 'parseError' } };
  }

  const calls = findRouterCalls(ast);
  for (const call of calls) {
    const inspected = await inspectDataRouterCall(call, ast, file, fs, root, sourceDir);
    if (inspected.router || inspected.unsupported) return inspected;
  }

  const jsxResult = findJsxRoutesElement(ast);
  if (jsxResult) {
    if (jsxResult.hasRoutes) {
      const line =
        typeof jsxResult.element.loc?.start?.line === 'number'
          ? jsxResult.element.loc.start.line
          : 1;
      return { router: { file, line, kind: 'jsxRoutes' } };
    }
    return { unsupported: { file, reason: 'noRoutes' } };
  }

  const exportedArray = findExportedArrayNode(ast);
  if (exportedArray && exportedArray.type === 'ArrayExpression') {
    const check = isLiteralArray(exportedArray);
    if (check.ok) {
      const line =
        typeof exportedArray.loc?.start?.line === 'number' ? exportedArray.loc.start.line : 1;
      return { router: { file, line, kind: 'dataRouter', moduleOnly: true } };
    }
    return { unsupported: { file, reason: check.reason ?? 'generated' } };
  }

  return {};
}

type TraversalResult = {
  readonly routers: Map<string, DiscoveredRouter>;
  readonly unsupported: DiscoveredUnsupported[];
};

async function traverseProjectFiles(
  fs: FileSystemPort,
  root: string,
  entryPoint: string,
  sourceDir: string,
): Promise<TraversalResult> {
  const routers = new Map<string, DiscoveredRouter>();
  const unsupported: DiscoveredUnsupported[] = [];
  const visited = new Set<string>();
  const queue: { file: string; depth: number }[] = [{ file: entryPoint, depth: 0 }];

  while (queue.length > 0 && visited.size < MAX_TRAVERSAL_FILES) {
    const item = queue.shift();
    if (!item || visited.has(item.file)) continue;
    visited.add(item.file);

    const inspected = await inspectFileForRouter(fs, root, item.file, sourceDir);
    if (inspected.router) {
      routers.set(inspected.router.file, inspected.router);
    } else if (inspected.unsupported) {
      unsupported.push(inspected.unsupported);
    }

    if (item.depth < MAX_TRAVERSAL_DEPTH) {
      const read = await fs.readText(root, item.file);
      if (read.ok) {
        try {
          const ast = parseJsxAst(read.value);
          for (const specifier of extractImportsFromAst(ast)) {
            const resolved = await resolveImportPath(fs, root, item.file, specifier, sourceDir);
            if (resolved && !visited.has(resolved)) {
              queue.push({ file: resolved, depth: item.depth + 1 });
            }
          }
        } catch {
          // ignore unparseable import branches
        }
      }
    }
  }

  return { routers, unsupported };
}

async function resolveExplicitRouting(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  routingFile: string,
): Promise<RouterStatus> {
  if (!(await fs.exists(root, routingFile))) {
    return { status: 'unsupported', file: routingFile, reason: 'noRoutes' };
  }
  const inspected = await inspectFileForRouter(fs, root, routingFile, sourceDir);
  if (inspected.router) {
    return {
      status: 'found',
      file: inspected.router.file,
      line: inspected.router.line,
      kind: inspected.router.kind,
      chosen: true,
    };
  }
  return {
    status: 'unsupported',
    file: routingFile,
    reason: inspected.unsupported?.reason ?? 'noRoutes',
  };
}

export async function findRouter(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  routingFile?: string,
): Promise<RouterStatus> {
  if (routingFile !== undefined && routingFile !== '') {
    return resolveExplicitRouting(fs, root, sourceDir, routingFile);
  }

  const entryPoint = await findEntryPoint(fs, root, sourceDir);
  if (!entryPoint) {
    const hasRouterPackage = await checkPackageJsonHasRouter(fs, root);
    return { status: 'none', hasRouterPackage };
  }

  const traversed = await traverseProjectFiles(fs, root, entryPoint, sourceDir);
  const { unsupported } = traversed;
  // Route modules spread into a createBrowserRouter/<Routes> file belong to that router.
  const real = [...traversed.routers.values()].filter((r) => r.moduleOnly !== true);
  const routers =
    real.length > 0 ? new Map(real.map((r) => [r.file, r] as const)) : traversed.routers;
  if (routers.size === 1) {
    const [r] = Array.from(routers.values());
    if (r) return { status: 'found', file: r.file, line: r.line, kind: r.kind, chosen: false };
  }
  if (routers.size >= 2) {
    const candidates = Array.from(routers.keys()).sort();
    return { status: 'ambiguous', candidates: candidates.slice(0, 10) };
  }
  const firstUnsupported = unsupported[0];
  if (firstUnsupported) {
    return {
      status: 'unsupported',
      file: firstUnsupported.file,
      reason: firstUnsupported.reason,
    };
  }

  const hasRouterPackage = await checkPackageJsonHasRouter(fs, root);
  return { status: 'none', hasRouterPackage };
}
