import type { PageInfo, PagesInfo, RouterStatus } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode, isAstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import {
  collectProjectRouteConstants,
  extractImportedFiles,
  extractImportedSymbols,
  findDynamicImportSpecifier,
  resolvePageFile,
  resolveRoutePathNode,
  resolveSpecifierBase,
  type RouteParseContext,
} from './route-constants.ts';
import { findRouter } from './route-finder.ts';

const MAX_FILES = 500;
const MAX_BYTES = 1024 * 1024;
const ROUTER_CALLS = new Set([
  'createBrowserRouter',
  'createHashRouter',
  'createMemoryRouter',
  'useRoutes',
]);
const HINT =
  /createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes|<Route\b|export\s+const\s+\w+\s*(?::[^=]+)?=\s*\[|lazy\(/;

type Found = {
  readonly path: string;
  readonly component?: string | undefined;
  readonly file: string;
  readonly directImportPath?: string | undefined;
};

/** Joins a child route path to its parent the way react-router does. */
export function joinRoutePath(parent: string, child: string | undefined): string {
  if (child === undefined || child === '') return parent === '' ? '/' : parent;
  const joined = child.startsWith('/') ? child : `${parent.replace(/\/$/, '')}/${child}`;
  const clean = joined.replace(/\/{2,}/g, '/');
  return clean.length > 1 ? clean.replace(/\/$/, '') : '/';
}

const stringOf = (node: AstNode | undefined): string | undefined =>
  node?.type === 'StringLiteral' && typeof node['value'] === 'string' ? node['value'] : undefined;

function jsxName(element: AstNode | undefined): string | undefined {
  const opening = asAstNode(element?.['openingElement']);
  const name = asAstNode(opening?.['name']);
  return name?.type === 'JSXIdentifier' && typeof name['name'] === 'string'
    ? name['name']
    : undefined;
}

/** Component of a route: `element: <Home />` or `Component: Home`. */
function componentOf(value: AstNode | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.type === 'JSXElement') return jsxName(value);
  if (value.type === 'JSXExpressionContainer') return componentOf(asAstNode(value['expression']));
  if (value.type === 'Identifier' && typeof value['name'] === 'string') return value['name'];
  return undefined;
}

function objectProps(obj: AstNode): Map<string, AstNode> {
  const props = new Map<string, AstNode>();
  const list: unknown[] = Array.isArray(obj['properties']) ? obj['properties'] : [];
  for (const raw of list) {
    const prop = asAstNode(raw);
    const key = asAstNode(prop?.['key']);
    const value = asAstNode(prop?.['value']);
    const name = key?.type === 'Identifier' ? key['name'] : stringOf(key);
    if (typeof name === 'string' && value !== undefined) props.set(name, value);
  }
  return props;
}

/** `[{ path, element, children }]` given to createBrowserRouter or useRoutes. */
function fromRouteArray(
  array: AstNode,
  parent: string,
  ctx: RouteParseContext,
  out: Found[],
): void {
  const elements: unknown[] = Array.isArray(array['elements']) ? array['elements'] : [];
  for (const raw of elements) {
    const obj = asAstNode(raw);
    if (obj?.type !== 'ObjectExpression') continue;
    const props = objectProps(obj);
    const resolvedPath = resolveRoutePathNode(props.get('path'), ctx);
    if (props.has('path') && resolvedPath === undefined) continue;
    const path = joinRoutePath(parent, resolvedPath);
    const component = componentOf(props.get('element') ?? props.get('Component'));
    const lazyProp = props.get('lazy');
    const lazySpec = lazyProp ? findDynamicImportSpecifier(lazyProp) : undefined;
    const directImportPath = lazySpec
      ? resolveSpecifierBase(ctx.file, ctx.sourceDir, lazySpec)
      : undefined;

    const children = props.get('children');
    if (children?.type === 'ArrayExpression') fromRouteArray(children, path, ctx, out);
    if (
      (component !== undefined || directImportPath !== undefined) &&
      (props.has('path') || props.has('index'))
    ) {
      out.push({ path, component, file: ctx.file, directImportPath });
    }
  }
}

function jsxAttrs(element: AstNode): Map<string, AstNode | undefined> {
  const attrs = new Map<string, AstNode | undefined>();
  const opening = asAstNode(element['openingElement']);
  const list: unknown[] = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  for (const raw of list) {
    const attr = asAstNode(raw);
    const name = asAstNode(attr?.['name']);
    if (attr?.type === 'JSXAttribute' && typeof name?.['name'] === 'string') {
      attrs.set(name['name'], asAstNode(attr['value']));
    }
  }
  return attrs;
}

/** `<Route path="…" element={<Page />}>` with nested routes. */
function fromRouteJsx(
  element: AstNode,
  parent: string,
  ctx: RouteParseContext,
  out: Found[],
): void {
  const attrs = jsxAttrs(element);
  const resolvedPath = resolveRoutePathNode(attrs.get('path'), ctx);
  if (attrs.has('path') && resolvedPath === undefined) return;
  const path = joinRoutePath(parent, resolvedPath);
  const component = componentOf(attrs.get('element') ?? attrs.get('Component'));
  const children: unknown[] = Array.isArray(element['children']) ? element['children'] : [];
  for (const raw of children) {
    const child = asAstNode(raw);
    if (child?.type === 'JSXElement' && jsxName(child) === 'Route') {
      fromRouteJsx(child, path, ctx, out);
    }
  }
  if (component !== undefined && (attrs.has('path') || attrs.has('index'))) {
    out.push({ path, component, file: ctx.file });
  }
}

const ROUTE_KEYS = ['path', 'index', 'children', 'lazy', 'element', 'Component'];

/** `export const publicRoutes = [{ path, … }]`: a route module spread into the router. */
function exportedRouteArrays(node: AstNode): AstNode[] {
  const decl = asAstNode(node['declaration']);
  if (decl?.type !== 'VariableDeclaration') return [];
  const list: unknown[] = Array.isArray(decl['declarations']) ? decl['declarations'] : [];
  return list
    .map((raw) => asAstNode(asAstNode(raw)?.['init']))
    .filter((init): init is AstNode => init?.type === 'ArrayExpression')
    .filter((array) => {
      const elements: unknown[] = Array.isArray(array['elements']) ? array['elements'] : [];
      return elements.some((raw) => {
        const obj = asAstNode(raw);
        return obj?.type === 'ObjectExpression' && ROUTE_KEYS.some((k) => objectProps(obj).has(k));
      });
    });
}

function walk(node: unknown, ctx: RouteParseContext, out: Found[]): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, ctx, out);
    return;
  }
  if (!isAstNode(node)) return;
  if (node.type === 'CallExpression') {
    const callee = asAstNode(node['callee']);
    const args: unknown[] = Array.isArray(node['arguments']) ? node['arguments'] : [];
    const first = asAstNode(args[0]);
    if (
      typeof callee?.['name'] === 'string' &&
      ROUTER_CALLS.has(callee['name']) &&
      first?.type === 'ArrayExpression'
    ) {
      fromRouteArray(first, '', ctx, out);
      return;
    }
  }
  if (node.type === 'JSXElement' && jsxName(node) === 'Route') {
    fromRouteJsx(node, '', ctx, out);
    return;
  }
  if (node.type === 'ExportNamedDeclaration') {
    const arrays = exportedRouteArrays(node);
    if (arrays.length > 0) {
      for (const array of arrays) fromRouteArray(array, '', ctx, out);
      return;
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'loc' && key !== 'leadingComments' && key !== 'trailingComments') {
      walk(value, ctx, out);
    }
  }
}

export async function listCodeFiles(fs: FileSystemPort, root: string, sourceDir: string) {
  const files: string[] = [];
  const pending = [sourceDir];
  while (pending.length > 0 && files.length < MAX_FILES) {
    const dir = pending.shift() ?? '';
    const entries = await fs.readDir(root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      const p = `${dir}/${entry.name}`;
      if (
        entry.kind === 'directory' &&
        entry.name !== 'node_modules' &&
        !entry.name.startsWith('.')
      ) {
        pending.push(p);
      } else if (entry.kind === 'file' && /\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        files.push(p);
      }
    }
  }
  return files;
}

function checkStandaloneArrayFile(ast: AstNode, ctx: RouteParseContext, out: Found[]): void {
  const program = asAstNode(ast['program']);
  const body: unknown[] = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ExportNamedDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'VariableDeclaration') {
        const decls: unknown[] = Array.isArray(decl['declarations']) ? decl['declarations'] : [];
        for (const raw of decls) {
          const d = asAstNode(raw);
          const init = asAstNode(d?.['init']);
          if (init?.type === 'ArrayExpression') fromRouteArray(init, '', ctx, out);
        }
      }
    }
  }
}

async function readConfiguredRoutingFile(
  fs: FileSystemPort,
  root: string,
): Promise<string | undefined> {
  const read = await fs.readText(root, '.kumicraft/workspace.json');
  if (!read.ok) return undefined;
  try {
    const json = JSON.parse(read.value) as Record<string, unknown>;
    const routing = json['routing'] as Record<string, string> | undefined;
    return typeof routing?.['file'] === 'string' ? routing['file'] : undefined;
  } catch {
    return undefined;
  }
}

async function buildPageInfos(
  fs: FileSystemPort,
  root: string,
  found: readonly Found[],
  importsByFile: Map<string, Map<string, string>>,
): Promise<PageInfo[]> {
  const seen = new Set<string>();
  const pages: PageInfo[] = [];
  for (const page of found) {
    if (page.path.includes('*') || seen.has(page.path)) continue;
    seen.add(page.path);

    const fileMap = importsByFile.get(page.file);
    const rawImport =
      page.directImportPath ??
      (page.component !== undefined ? fileMap?.get(page.component) : undefined);
    const resolvedFile = await resolvePageFile(fs, root, rawImport);

    pages.push({
      path: page.path,
      ...(page.component === undefined ? {} : { component: page.component }),
      ...(resolvedFile === undefined ? {} : { file: resolvedFile }),
      dynamic: page.path.includes(':'),
    });
  }
  return pages;
}

export async function readPages(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  routingFile?: string,
): Promise<PagesInfo> {
  const effectiveRoutingFile = routingFile ?? (await readConfiguredRoutingFile(fs, root));
  const router: RouterStatus = await findRouter(fs, root, sourceDir, effectiveRoutingFile);
  const found: Found[] = [];
  const importsByFile = new Map<string, Map<string, string>>();

  // Pages come from every code file, as before K3d; the router only says which file edits go to.
  const codeFiles = await listCodeFiles(fs, root, sourceDir);
  const constantsByFile = await collectProjectRouteConstants(fs, root, codeFiles);

  for (const file of codeFiles) {
    const read = await fs.readText(root, file, { maxBytes: MAX_BYTES });
    if (!read.ok || !HINT.test(read.value)) continue;
    let ast: AstNode;
    try {
      ast = parseJsxAst(read.value);
    } catch {
      continue;
    }
    importsByFile.set(file, extractImportedFiles(ast, file, sourceDir));
    const ctx: RouteParseContext = {
      file,
      sourceDir,
      imports: extractImportedSymbols(ast, file, sourceDir),
      constantsByFile,
    };
    const beforeCount = found.length;
    walk(ast, ctx, found);
    if (router.status === 'found' && router.file === file && found.length === beforeCount) {
      checkStandaloneArrayFile(ast, ctx, found);
    }
  }

  const pages = await buildPageInfos(fs, root, found, importsByFile);
  return {
    convention: router.status === 'found',
    ...(router.status === 'found' ? { routesFile: router.file } : {}),
    router,
    pages,
  };
}
