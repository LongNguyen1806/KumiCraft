// JSX Routes manipulation helpers (SPEC-04 K3d section 3.3).
import { err, ok, type Result } from '@kumicraft/shared';

import { asAstNode, type AstNode } from '../source-editor/ast-helpers.ts';
import type { TextEdit } from '../source-editor/structure/text-edits.ts';
import { joinRoutePath } from './pages.ts';
import type { FoundRouteNode } from './routes-ast.ts';
import { detectFileQuote, findImportRemovalEdit, findLastImportEnd } from './routes-ast.ts';

function jsxName(element: AstNode | undefined): string | undefined {
  const opening = asAstNode(element?.['openingElement']);
  const name = asAstNode(opening?.['name']);
  return name?.type === 'JSXIdentifier' && typeof name['name'] === 'string'
    ? name['name']
    : undefined;
}

export function getJsxAttr(element: AstNode, attrName: string): AstNode | undefined {
  const opening = asAstNode(element['openingElement']);
  const list: unknown[] = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  for (const raw of list) {
    const attr = asAstNode(raw);
    const name = asAstNode(attr?.['name']);
    if (attr?.type === 'JSXAttribute' && name?.['name'] === attrName) {
      return asAstNode(attr['value']);
    }
  }
  return undefined;
}

export function getJsxStringAttr(element: AstNode, attrName: string): string | undefined {
  const val = getJsxAttr(element, attrName);
  if (!val) return undefined;
  if (val.type === 'StringLiteral' && typeof val['value'] === 'string') return val['value'];
  if (val.type === 'JSXExpressionContainer') {
    const expr = asAstNode(val['expression']);
    if (expr?.type === 'StringLiteral' && typeof expr['value'] === 'string') return expr['value'];
  }
  return undefined;
}

function getJsxComponentAttr(element: AstNode): string | undefined {
  const elem = getJsxAttr(element, 'element') ?? getJsxAttr(element, 'Component');
  if (!elem) return undefined;
  if (elem.type === 'JSXElement') return jsxName(elem);
  if (elem.type === 'JSXExpressionContainer') {
    const expr = asAstNode(elem['expression']);
    if (expr?.type === 'JSXElement') return jsxName(expr);
    if (expr?.type === 'Identifier' && typeof expr['name'] === 'string') return expr['name'];
  }
  if (elem.type === 'Identifier' && typeof elem['name'] === 'string') return elem['name'];
  return undefined;
}

export function findJsxRoutesElement(ast: AstNode): AstNode | undefined {
  let found: AstNode | undefined;
  function search(node: unknown): void {
    if (found || !node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (n.type === 'JSXElement' && jsxName(n) === 'Routes') {
      found = n;
      return;
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') search(v);
    }
  }
  search(ast);
  return found;
}

export function getDirectChildRoutes(parent: AstNode): AstNode[] {
  const children: unknown[] = Array.isArray(parent['children']) ? parent['children'] : [];
  const list: AstNode[] = [];
  for (const raw of children) {
    const child = asAstNode(raw);
    if (child?.type === 'JSXElement' && jsxName(child) === 'Route') {
      list.push(child);
    }
  }
  return list;
}

export function findTargetJsxParent(routesElement: AstNode): AstNode {
  const directRoutes = getDirectChildRoutes(routesElement);
  if (directRoutes.length === 1) {
    const onlyRoute = directRoutes[0];
    if (onlyRoute) {
      const hasLayout = getJsxAttr(onlyRoute, 'element') ?? getJsxAttr(onlyRoute, 'Component');
      const innerRoutes = getDirectChildRoutes(onlyRoute);
      if (hasLayout && innerRoutes.length > 0) return onlyRoute;
    }
  }
  return routesElement;
}

export function findJsxRouteNodes(
  element: AstNode,
  parentPath = '',
  out: FoundRouteNode[] = [],
): FoundRouteNode[] {
  const directRoutes = getDirectChildRoutes(element);
  for (const route of directRoutes) {
    const rawPath = getJsxStringAttr(route, 'path');
    const fullPath = joinRoutePath(parentPath, rawPath);
    const isIndex = getJsxAttr(route, 'index') !== undefined;
    const children = getDirectChildRoutes(route);
    const hasChildren = children.length > 0;
    const componentName = getJsxComponentAttr(route);

    out.push({
      routeNode: route,
      pathProp: getJsxAttr(route, 'path'),
      fullPath,
      rawPath,
      isIndex,
      hasChildren,
      componentName,
      elementNode: getJsxAttr(route, 'element') ?? getJsxAttr(route, 'Component'),
      parentArray: element,
    });

    if (hasChildren) {
      findJsxRouteNodes(route, fullPath, out);
    }
  }
  return out;
}

function detectQuoteStyle(
  ast: AstNode,
  targetParent: AstNode,
  code: string,
): { quote: "'" | '"'; isExpression: boolean } {
  const { quote } = detectFileQuote(ast, code);
  const children = getDirectChildRoutes(targetParent);
  let exprCount = 0;
  for (const child of children) {
    const attr = getJsxAttr(child, 'path');
    if (attr?.type === 'JSXExpressionContainer') exprCount++;
  }
  return {
    quote,
    isExpression: children.length > 0 && exprCount > children.length / 2,
  };
}

function detectRelativePath(targetParent: AstNode, desiredPath: string): string {
  const children = getDirectChildRoutes(targetParent);
  let relCount = 0;
  let absCount = 0;
  for (const child of children) {
    const p = getJsxStringAttr(child, 'path');
    if (p && p !== '*') {
      if (p.startsWith('/')) absCount++;
      else relCount++;
    }
  }
  if (relCount >= absCount) return desiredPath.replace(/^\//, '');
  return desiredPath.startsWith('/') ? desiredPath : `/${desiredPath}`;
}

function getLineIndentation(code: string, offset: number): string {
  let lineStart = offset;
  while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
  const line = code.slice(lineStart, offset);
  const match = line.match(/^[ \t]*/);
  return match ? match[0] : '    ';
}

function buildRouteLine(
  indent: string,
  cleanPath: string,
  component: string,
  quoteStyle: { quote: string; isExpression: boolean },
  nl: string,
): string {
  const pathAttr = quoteStyle.isExpression
    ? `path={${quoteStyle.quote}${cleanPath}${quoteStyle.quote}}`
    : `path=${quoteStyle.quote}${cleanPath}${quoteStyle.quote}`;
  return `${indent}<Route ${pathAttr} element={<${component} />} />${nl}`;
}

function resolveJsxInsertLocation(
  targetParent: AstNode,
  directRoutes: readonly AstNode[],
  code: string,
): Result<{ insertPos: number; indent: string }> {
  const starChild = directRoutes.find((r) => getJsxStringAttr(r, 'path') === '*');
  if (starChild && typeof starChild.start === 'number') {
    let lineStart = starChild.start;
    while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
    return ok({ insertPos: lineStart, indent: getLineIndentation(code, starChild.start) });
  }
  const closing = asAstNode(targetParent['closingElement']);
  if (!closing || typeof closing.start !== 'number') {
    return err({ code: 'E016', params: { reason: 'routerUnsupported' } });
  }
  let lineStart = closing.start;
  while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
  const firstChild = directRoutes[0];
  const indent =
    firstChild && typeof firstChild.start === 'number'
      ? getLineIndentation(code, firstChild.start)
      : `${getLineIndentation(code, typeof targetParent.start === 'number' ? targetParent.start : closing.start)}  `;
  return ok({ insertPos: lineStart, indent });
}

export function planAddJsxRouteEdits(
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
  const routesElem = findJsxRoutesElement(ast);
  if (!routesElem) return err({ code: 'E016', params: { reason: 'routerMissing' } });

  const targetParent = findTargetJsxParent(routesElem);
  const cleanPath = detectRelativePath(targetParent, params.routePath);
  const quoteStyle = detectQuoteStyle(ast, targetParent, code);
  const directRoutes = getDirectChildRoutes(targetParent);

  const locRes = resolveJsxInsertLocation(targetParent, directRoutes, code);
  if (!locRes.ok) return locRes;
  const { insertPos, indent } = locRes.value;

  const lineText = buildRouteLine(indent, cleanPath, params.component, quoteStyle, nl);
  const importPos = findLastImportEnd(ast, code);
  const quote = quoteStyle.quote;
  const importText = params.isDefaultExport
    ? `import ${params.component} from ${quote}${params.importPath}${quote};${nl}`
    : `import { ${params.component} } from ${quote}${params.importPath}${quote};${nl}`;

  return ok([
    { start: importPos, end: importPos, text: importText },
    { start: insertPos, end: insertPos, text: lineText },
  ]);
}

function hasOtherUsageOfComponent(
  ast: AstNode,
  routeNode: AstNode,
  componentName: string,
): boolean {
  let hasOther = false;
  const start = typeof routeNode.start === 'number' ? routeNode.start : -1;
  const end = typeof routeNode.end === 'number' ? routeNode.end : -1;

  function search(node: unknown): void {
    if (hasOther || !node || typeof node !== 'object') return;
    const n = node as AstNode;
    if (typeof n.start === 'number' && typeof n.end === 'number') {
      if (n.start >= start && n.end <= end) return;
    }
    if (n.type === 'ImportDeclaration') return;
    if (n.type === 'JSXIdentifier' && n['name'] === componentName) {
      hasOther = true;
      return;
    }
    if (n.type === 'Identifier' && n['name'] === componentName) {
      hasOther = true;
      return;
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') search(v);
    }
  }
  search(ast);
  return hasOther;
}

export function planDeleteJsxRouteEdits(
  ast: AstNode,
  code: string,
  routeNode: AstNode,
  componentName?: string,
): Result<readonly TextEdit[]> {
  const edits: TextEdit[] = [];
  if (typeof routeNode.start !== 'number' || typeof routeNode.end !== 'number') {
    return err({ code: 'E016', params: { reason: 'invalidRoute' } });
  }

  let lineStart = routeNode.start;
  while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--;
  let lineEnd = routeNode.end;
  while (lineEnd < code.length && code[lineEnd] !== '\n') lineEnd++;
  if (code[lineEnd] === '\n') lineEnd++;

  edits.push({ start: lineStart, end: lineEnd, text: '' });

  if (componentName && !hasOtherUsageOfComponent(ast, routeNode, componentName)) {
    const importEdit = findImportRemovalEdit(ast, code, componentName);
    if (importEdit) edits.push(importEdit);
  }

  return ok(edits);
}
