// AST manipulation helpers for routes.tsx (R-PG-11 to R-PG-14).
import { err, ok, type Result } from '@kumicraft/shared';

import { asAstNode, type AstNode } from '../source-editor/ast-helpers.ts';
import type { TextEdit } from '../source-editor/structure/text-edits.ts';
import { joinRoutePath } from './pages.ts';
import {
  findJsxRouteNodes,
  findJsxRoutesElement,
  planAddJsxRouteEdits,
  planDeleteJsxRouteEdits,
} from './routes-jsx.ts';

const ROUTER_CALLS = new Set([
  'createBrowserRouter',
  'createHashRouter',
  'createMemoryRouter',
  'useRoutes',
]);

export const stringOf = (node: AstNode | undefined): string | undefined =>
  node?.type === 'StringLiteral' && typeof node['value'] === 'string' ? node['value'] : undefined;

export function objectProps(obj: AstNode): Map<string, AstNode> {
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

export type FoundRouteNode = {
  readonly routeNode: AstNode;
  readonly pathProp?: AstNode | undefined;
  readonly fullPath: string;
  readonly rawPath?: string | undefined;
  readonly isIndex: boolean;
  readonly hasChildren: boolean;
  readonly componentName?: string | undefined;
  readonly elementNode?: AstNode | undefined;
  readonly parentArray: AstNode;
};

/** Finds all route ObjectExpressions or JSX Route elements with their full paths. */
export function findRouteNodes(
  node: AstNode,
  parentPath = '',
  out: FoundRouteNode[] = [],
): FoundRouteNode[] {
  if (node.type !== 'ArrayExpression') {
    const jsxRoutes = findJsxRoutesElement(node);
    if (jsxRoutes) {
      return findJsxRouteNodes(jsxRoutes, parentPath, out);
    }
    return out;
  }
  const arrayNode = node;
  const elements: unknown[] = Array.isArray(arrayNode['elements']) ? arrayNode['elements'] : [];
  for (const raw of elements) {
    const obj = asAstNode(raw);
    if (obj?.type !== 'ObjectExpression') continue;
    const props = objectProps(obj);
    const rawPath = stringOf(props.get('path'));
    const fullPath = joinRoutePath(parentPath, rawPath);
    const isIndex = props.has('index');
    const hasChildren = props.has('children');
    const elemProp = props.get('element') ?? props.get('Component');
    const componentName = elemProp ? getElementComponentName(elemProp) : undefined;

    out.push({
      routeNode: obj,
      pathProp: props.get('path'),
      fullPath,
      rawPath,
      isIndex,
      hasChildren,
      componentName,
      elementNode: elemProp,
      parentArray: arrayNode,
    });

    const children = props.get('children');
    if (children?.type === 'ArrayExpression') {
      findRouteNodes(children, fullPath, out);
    }
  }
  return out;
}

function getElementComponentName(elemProp: AstNode): string | undefined {
  if (elemProp.type === 'JSXElement') {
    const opening = asAstNode(elemProp['openingElement']);
    const name = asAstNode(opening?.['name']);
    return name?.type === 'JSXIdentifier' && typeof name['name'] === 'string'
      ? name['name']
      : undefined;
  }
  if (elemProp.type === 'Identifier' && typeof elemProp['name'] === 'string') {
    return elemProp['name'];
  }
  return undefined;
}

/** Finds the router array passed to createBrowserRouter in AST. */
export function findRouterArray(ast: AstNode): AstNode | undefined {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];

  let found: AstNode | undefined;
  function search(node: unknown): void {
    if (found || !node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (n.type === 'CallExpression') {
      const callee = asAstNode(n['callee']);
      const args: unknown[] = Array.isArray(n['arguments']) ? n['arguments'] : [];
      const first = asAstNode(args[0]);
      if (
        typeof callee?.['name'] === 'string' &&
        ROUTER_CALLS.has(callee['name']) &&
        first?.type === 'ArrayExpression'
      ) {
        found = first;
        return;
      }
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') {
        search(v);
      }
    }
  }

  for (const item of body) search(item);
  return found;
}

/** Finds insertion offset after the last ImportDeclaration. */
export function findLastImportEnd(ast: AstNode, code: string): number {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  let lastEnd = -1;

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration' && typeof stmt.end === 'number') {
      if (stmt.end > lastEnd) lastEnd = stmt.end;
    }
  }

  if (lastEnd === -1) return 0;
  let pos = lastEnd;
  while (pos < code.length && code[pos] !== '\n') pos++;
  return pos < code.length && code[pos] === '\n' ? pos + 1 : lastEnd;
}

/** Determines whether existing page imports in routes.tsx use file extensions (.tsx/.jsx). */
export function routesUseExtension(ast: AstNode): boolean {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration') {
      const src = stringOf(asAstNode(stmt['source']));
      if (src && src.startsWith('.') && /\.(tsx|jsx)$/.test(src)) return true;
    }
  }
  return false;
}

function getLineIndentation(code: string, offset: number): string {
  let lineStart = offset;
  while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
  const line = code.slice(lineStart, offset);
  const match = line.match(/^[ \t]*/);
  return match ? match[0] : '    ';
}

export function detectFileQuote(ast: AstNode, code: string): { quote: "'" | '"' } {
  let singleCount = 0;
  let doubleCount = 0;

  function search(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (n.type === 'StringLiteral') {
      const start = typeof n.start === 'number' ? n.start : undefined;
      const raw = start !== undefined ? code[start] : undefined;
      if (raw === "'") singleCount++;
      else if (raw === '"') doubleCount++;
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') {
        search(v);
      }
    }
  }

  search(ast);
  return { quote: singleCount >= doubleCount ? "'" : '"' };
}

function planChildrenRouteInsert(
  childrenArray: AstNode,
  code: string,
  nl: string,
  cleanPath: string,
  component: string,
  quote: string,
): TextEdit | undefined {
  const childElements: unknown[] = Array.isArray(childrenArray['elements'])
    ? childrenArray['elements']
    : [];

  const starChild = childElements.find((raw) => {
    const obj = asAstNode(raw);
    return obj?.type === 'ObjectExpression' && stringOf(objectProps(obj).get('path')) === '*';
  });

  const starNode = asAstNode(starChild);
  if (starNode && typeof starNode.start === 'number') {
    let lineStart = starNode.start;
    while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
    const indent = getLineIndentation(code, starNode.start);
    const text = `${indent}{ path: ${quote}${cleanPath}${quote}, element: <${component} /> },${nl}`;
    return { start: lineStart, end: lineStart, text };
  }
  if (typeof childrenArray.end === 'number') {
    const closeBracketPos = childrenArray.end - 1;
    const indent = `${getLineIndentation(code, closeBracketPos)}  `;
    const text = `${indent}{ path: ${quote}${cleanPath}${quote}, element: <${component} /> },${nl}`;
    return { start: closeBracketPos, end: closeBracketPos, text };
  }
  return undefined;
}

function createImportEdit(
  ast: AstNode,
  code: string,
  nl: string,
  component: string,
  importPath: string,
  quote: string,
  isDefaultExport?: boolean,
): TextEdit {
  const importPos = findLastImportEnd(ast, code);
  const text = isDefaultExport
    ? `import ${component} from ${quote}${importPath}${quote};${nl}`
    : `import { ${component} } from ${quote}${importPath}${quote};${nl}`;
  return { start: importPos, end: importPos, text };
}

function planArrayRouteInsert(
  routerArray: AstNode,
  code: string,
  nl: string,
  routePath: string,
  component: string,
  quote: string,
): TextEdit | undefined {
  const elements: unknown[] = Array.isArray(routerArray['elements']) ? routerArray['elements'] : [];
  const rootObj = asAstNode(elements[0]);
  const rootProps = rootObj ? objectProps(rootObj) : undefined;
  const childrenArray =
    elements.length === 1 && rootObj?.type === 'ObjectExpression'
      ? rootProps?.get('children')
      : undefined;

  if (childrenArray?.type === 'ArrayExpression') {
    return planChildrenRouteInsert(
      childrenArray,
      code,
      nl,
      routePath.replace(/^\//, ''),
      component,
      quote,
    );
  }
  if (typeof routerArray.end === 'number') {
    const closeBracketPos = routerArray.end - 1;
    const indent = `${getLineIndentation(code, closeBracketPos)}  `;
    const text = `${indent}{ path: ${quote}${routePath}${quote}, element: <${component} /> },${nl}`;
    return { start: closeBracketPos, end: closeBracketPos, text };
  }
  return undefined;
}

/** Generates edits to add a route and its import to routes.tsx. */
export function planAddRouteEdits(
  ast: AstNode,
  code: string,
  nl: string,
  params: {
    readonly component: string;
    readonly importPath: string;
    readonly routePath: string;
    readonly isDefaultExport?: boolean;
  },
): Result<readonly TextEdit[]> {
  const routerArray = findRouterArray(ast);
  if (!routerArray) {
    const jsxRoutes = findJsxRoutesElement(ast);
    if (jsxRoutes) {
      return planAddJsxRouteEdits(ast, code, nl, params);
    }
    return err({ code: 'E016', params: { reason: 'routerMissing' } });
  }

  const { quote } = detectFileQuote(ast, code);
  const edits: TextEdit[] = [
    createImportEdit(
      ast,
      code,
      nl,
      params.component,
      params.importPath,
      quote,
      params.isDefaultExport,
    ),
  ];

  const routeEdit = planArrayRouteInsert(
    routerArray,
    code,
    nl,
    params.routePath,
    params.component,
    quote,
  );
  if (routeEdit) edits.push(routeEdit);

  return ok(edits);
}

/** Generates edits to remove a route object and optionally its unused import. */
export function planDeleteRouteEdits(
  ast: AstNode,
  code: string,
  routeNode: AstNode,
  componentName?: string,
): Result<readonly TextEdit[]> {
  if (routeNode.type === 'JSXElement') {
    return planDeleteJsxRouteEdits(ast, code, routeNode, componentName);
  }
  const edits: TextEdit[] = [];
  if (typeof routeNode.start !== 'number' || typeof routeNode.end !== 'number') {
    return err({ code: 'E016', params: { reason: 'invalidRoute' } });
  }

  let lineStart = routeNode.start;
  while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
  let lineEnd = routeNode.end;
  if (code[lineEnd] === ',') lineEnd++;
  while (lineEnd < code.length && code[lineEnd] !== '\n') lineEnd++;
  if (code[lineEnd] === '\n') lineEnd++;

  edits.push({ start: lineStart, end: lineEnd, text: '' });

  if (componentName) {
    const allRoutes = findRouteNodes(findRouterArray(ast) ?? ast);
    const otherUsages = allRoutes.filter(
      (r) => r.routeNode !== routeNode && r.componentName === componentName,
    );
    if (otherUsages.length === 0) {
      const importEdit = findImportRemovalEdit(ast, code, componentName);
      if (importEdit) edits.push(importEdit);
    }
  }

  return ok(edits);
}

export function findImportRemovalEdit(
  ast: AstNode,
  code: string,
  componentName: string,
): TextEdit | undefined {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    const hasComponent = specifiers.some((s) => {
      const node = asAstNode(s);
      const local = asAstNode(node?.['local']);
      return local?.['name'] === componentName;
    });

    if (hasComponent && specifiers.length === 1) {
      if (typeof stmt.start !== 'number' || typeof stmt.end !== 'number') continue;
      let lineStart = stmt.start;
      while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
      let lineEnd = stmt.end;
      while (lineEnd < code.length && code[lineEnd] !== '\n') lineEnd++;
      if (code[lineEnd] === '\n') lineEnd++;
      return { start: lineStart, end: lineEnd, text: '' };
    }
  }
  return undefined;
}
