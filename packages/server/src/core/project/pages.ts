// Pages of the project read from its router (SPEC-04 M-PG R-PG-10, R-PG-15): enough to list and
// navigate pages in the Canvas, whatever folder layout the project uses.
import type { PageInfo, PagesInfo } from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode, isAstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';

const MAX_FILES = 500;
const MAX_BYTES = 1024 * 1024;
const ROUTER_CALLS = new Set([
  'createBrowserRouter',
  'createHashRouter',
  'createMemoryRouter',
  'useRoutes',
]);
const HINT = /createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes|<Route\b/;

type Found = {
  readonly path: string;
  readonly component?: string | undefined;
  readonly file: string;
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
function fromRouteArray(array: AstNode, parent: string, file: string, out: Found[]): void {
  const elements: unknown[] = Array.isArray(array['elements']) ? array['elements'] : [];
  for (const raw of elements) {
    const obj = asAstNode(raw);
    if (obj?.type !== 'ObjectExpression') continue;
    const props = objectProps(obj);
    const path = joinRoutePath(parent, stringOf(props.get('path')));
    const component = componentOf(props.get('element') ?? props.get('Component'));
    const children = props.get('children');
    if (children?.type === 'ArrayExpression') fromRouteArray(children, path, file, out);
    if (component !== undefined && (props.has('path') || props.has('index'))) {
      out.push({ path, component, file });
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
function fromRouteJsx(element: AstNode, parent: string, file: string, out: Found[]): void {
  const attrs = jsxAttrs(element);
  const path = joinRoutePath(parent, stringOf(attrs.get('path')));
  const component = componentOf(attrs.get('element') ?? attrs.get('Component'));
  // Children first: an index route is the page at this path, not the layout around it.
  const children: unknown[] = Array.isArray(element['children']) ? element['children'] : [];
  for (const raw of children) {
    const child = asAstNode(raw);
    if (child?.type === 'JSXElement' && jsxName(child) === 'Route') {
      fromRouteJsx(child, path, file, out);
    }
  }
  if (component !== undefined && (attrs.has('path') || attrs.has('index'))) {
    out.push({ path, component, file });
  }
}

function walk(node: unknown, file: string, out: Found[]): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, file, out);
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
      fromRouteArray(first, '', file, out);
      return;
    }
  }
  if (node.type === 'JSXElement' && jsxName(node) === 'Route') {
    fromRouteJsx(node, '', file, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'loc' && key !== 'leadingComments' && key !== 'trailingComments') {
      walk(value, file, out);
    }
  }
}

async function listCodeFiles(fs: FileSystemPort, root: string, sourceDir: string) {
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
      } else if (entry.kind === 'file' && /\.(tsx|jsx|ts|js)$/.test(entry.name)) {
        files.push(path);
      }
    }
  }
  return files;
}

/** R-PG-10: the convention is `src/routes.tsx` (or `.jsx`) built with createBrowserRouter. */
function isConventionFile(file: string, sourceDir: string, text: string): boolean {
  return (
    /^(routes)\.(tsx|jsx)$/.test(file.slice(sourceDir.length + 1)) &&
    text.includes('createBrowserRouter')
  );
}

export async function readPages(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<PagesInfo> {
  const found: Found[] = [];
  let routesFile: string | undefined;
  for (const file of await listCodeFiles(fs, root, sourceDir)) {
    const read = await fs.readText(root, file, { maxBytes: MAX_BYTES });
    if (!read.ok || !HINT.test(read.value)) continue;
    let ast: AstNode;
    try {
      ast = parseJsxAst(read.value);
    } catch {
      continue; // a file that does not parse lists no pages; the dev server reports it
    }
    if (routesFile === undefined && isConventionFile(file, sourceDir, read.value))
      routesFile = file;
    walk(ast, file, found);
  }
  const seen = new Set<string>();
  const pages: PageInfo[] = [];
  for (const page of found) {
    if (page.path.includes('*') || seen.has(page.path)) continue;
    seen.add(page.path);
    pages.push({
      path: page.path,
      ...(page.component === undefined ? {} : { component: page.component }),
      dynamic: page.path.includes(':'),
    });
  }
  return {
    convention: routesFile !== undefined,
    ...(routesFile === undefined ? {} : { routesFile }),
    pages,
  };
}
