// AST scope and import analysis for component extraction (SPEC-04 R-CP-14, spec-log #24).
import { err, ok, type Result } from '@kumicraft/shared';

import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { resolveRelativeImportSource } from '../source-editor/structure/imports.ts';

const GLOBALS = new Set([
  'Math',
  'Date',
  'JSON',
  'Number',
  'String',
  'Array',
  'Object',
  'Boolean',
  'Intl',
  'window',
  'document',
  'console',
  'encodeURIComponent',
  'undefined',
]);

export function getImportedNames(ast: AstNode): ReadonlySet<string> {
  const names = new Set<string>();
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration') {
      const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
      for (const spec of specifiers) {
        const local = asAstNode(asAstNode(spec)?.['local']);
        if (typeof local?.['name'] === 'string') names.add(local['name']);
      }
    }
  }
  return names;
}

function collectPatternIds(pattern: AstNode | undefined, out: Set<string>): void {
  if (!pattern) return;
  if (pattern.type === 'Identifier' && typeof pattern['name'] === 'string') {
    out.add(pattern['name']);
  } else if (pattern.type === 'ObjectPattern') {
    const props = Array.isArray(pattern['properties']) ? pattern['properties'] : [];
    for (const prop of props) {
      const p = asAstNode(prop);
      if (p?.type === 'ObjectProperty') collectPatternIds(asAstNode(p['value']), out);
      else if (p?.type === 'RestElement') collectPatternIds(asAstNode(p['argument']), out);
    }
  } else if (pattern.type === 'ArrayPattern') {
    const elements = Array.isArray(pattern['elements']) ? pattern['elements'] : [];
    for (const el of elements) collectPatternIds(asAstNode(el), out);
  } else if (pattern.type === 'AssignmentPattern') {
    collectPatternIds(asAstNode(pattern['left']), out);
  }
}

function collectLocalDeclaredIds(node: AstNode, out: Set<string>): void {
  const params = Array.isArray(node['params']) ? node['params'] : [];
  for (const p of params) collectPatternIds(asAstNode(p), out);
  const body = asAstNode(node['body']);
  if (body?.type === 'BlockStatement') {
    const stmts = Array.isArray(body['body']) ? body['body'] : [];
    for (const stmt of stmts) {
      const s = asAstNode(stmt);
      if (s?.type === 'VariableDeclaration') {
        const decls = Array.isArray(s['declarations']) ? s['declarations'] : [];
        for (const d of decls) collectPatternIds(asAstNode(asAstNode(d)?.['id']), out);
      }
    }
  }
}

type ScopeChecker = {
  readonly importedNames: ReadonlySet<string>;
  readonly neededNames: Set<string>;
  /** Names of the old component the selection uses, in order of first use: they become props. */
  readonly propNames: string[];
  errorName?: string | undefined;
};

/** FR-72: a name from the old component (a variable, a handler, a local component) is a prop. */
function addProp(checker: ScopeChecker, name: string): void {
  if (!checker.propNames.includes(name)) checker.propNames.push(name);
}

function checkJsxElementTag(ast: AstNode, checker: ScopeChecker): boolean {
  const opening = asAstNode(ast['openingElement']);
  const nameNode = asAstNode(opening?.['name']);
  if (!nameNode) return true;
  let rootTag: string | undefined;
  if (nameNode.type === 'JSXIdentifier' && typeof nameNode['name'] === 'string') {
    if (/^[A-Z]/.test(nameNode['name'])) rootTag = nameNode['name'];
  } else if (nameNode.type === 'JSXMemberExpression') {
    let curr = nameNode;
    while (curr['object'] && asAstNode(curr['object'])?.type === 'JSXMemberExpression') {
      const next = asAstNode(curr['object']);
      if (!next) break;
      curr = next;
    }
    const rootObj = asAstNode(curr['object']);
    if (rootObj?.type === 'JSXIdentifier' && typeof rootObj['name'] === 'string') {
      if (/^[A-Z]/.test(rootObj['name'])) rootTag = rootObj['name'];
    }
  }
  if (rootTag !== undefined) {
    if (checker.importedNames.has(rootTag)) checker.neededNames.add(rootTag);
    else if (!GLOBALS.has(rootTag)) addProp(checker, rootTag);
  }
  return true;
}

function checkAstChildren(
  ast: AstNode,
  checker: ScopeChecker,
  activeScopes: ReadonlySet<string>[],
): boolean {
  for (const key of Object.keys(ast)) {
    if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
    const child = ast[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (!checkExpressionAst(item, checker, activeScopes, ast, key)) return false;
      }
    } else if (child !== undefined && typeof child === 'object') {
      if (!checkExpressionAst(child, checker, activeScopes, ast, key)) return false;
    }
  }
  return true;
}

function checkExpressionAst(
  node: unknown,
  checker: ScopeChecker,
  scopes: ReadonlySet<string>[],
  parent?: AstNode,
  parentProp?: string,
): boolean {
  const ast = asAstNode(node);
  if (!ast) return true;
  if (checker.errorName !== undefined) return false;

  let activeScopes = scopes;
  if (ast.type === 'ArrowFunctionExpression' || ast.type === 'FunctionExpression') {
    const local = new Set<string>();
    collectLocalDeclaredIds(ast, local);
    activeScopes = [...scopes, local];
  }

  if (ast.type === 'Identifier' && typeof ast['name'] === 'string') {
    const name = ast['name'];
    const isMemberProp =
      parent?.type === 'MemberExpression' && parentProp === 'property' && !parent['computed'];
    const isObjectKey =
      parent?.type === 'ObjectProperty' &&
      parentProp === 'key' &&
      !parent['computed'] &&
      !parent['shorthand'];
    if (!isMemberProp && !isObjectKey) {
      const isLocal = activeScopes.some((s) => s.has(name));
      if (!isLocal && !GLOBALS.has(name)) {
        if (checker.importedNames.has(name)) checker.neededNames.add(name);
        else addProp(checker, name);
      }
    }
  }

  return checkAstChildren(ast, checker, activeScopes);
}

function walkSubtreeScope(node: AstNode, checker: ScopeChecker): boolean {
  if (node.type === 'JSXElement') {
    if (!checkJsxElementTag(node, checker)) return false;
  }
  if (node.type === 'JSXExpressionContainer' || node.type === 'JSXSpreadAttribute') {
    const expr = asAstNode(node['expression'] ?? node['argument']);
    if (expr && !checkExpressionAst(expr, checker, [])) return false;
    return true;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        const itemNode = asAstNode(item);
        if (itemNode && !walkSubtreeScope(itemNode, checker)) return false;
      }
    } else if (child !== undefined && typeof child === 'object') {
      const childNode = asAstNode(child);
      if (childNode && !walkSubtreeScope(childNode, checker)) return false;
    }
  }
  return true;
}

export type ScopeUsage = {
  /** Imported names the new file imports too. */
  readonly needed: ReadonlySet<string>;
  /** Names of the old component, passed to the new one as props of the same name. */
  readonly props: readonly string[];
};

export function checkScopeUsage(targetNode: AstNode, sourceAst: AstNode): Result<ScopeUsage> {
  const importedNames = getImportedNames(sourceAst);
  const checker: ScopeChecker = { importedNames, neededNames: new Set(), propNames: [] };
  if (!walkSubtreeScope(targetNode, checker)) {
    return err({
      code: 'E023',
      params: { reason: 'usesLocalScope', name: checker.errorName ?? '' },
    });
  }
  return ok({ needed: checker.neededNames, props: checker.propNames });
}

export function remapImportStatement(stmtStr: string, fromFile: string, toFile: string): string {
  try {
    const parsed = parseJsxAst(stmtStr);
    const prog = asAstNode(parsed['program']);
    const body = Array.isArray(prog?.['body']) ? prog['body'] : [];
    const decl = asAstNode(body[0]);
    if (decl?.type === 'ImportDeclaration') {
      const srcNode = asAstNode(decl['source']);
      const srcVal = typeof srcNode?.['value'] === 'string' ? srcNode['value'] : '';
      if (srcVal.startsWith('.')) {
        const newSrc = resolveRelativeImportSource(fromFile, toFile, srcVal);
        return stmtStr.replace(/(['"])[^'"]+\1/, `$1${newSrc}$1`);
      }
    }
  } catch {
    // If parse fails, keep original
  }
  return stmtStr;
}
