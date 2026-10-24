// Structural edit guards for JSX elements (SPEC-04 R-SE-21).
import { err, ok, type Result } from '@kumicraft/shared';

import { asAstNode, type AstNode } from '../ast-helpers.ts';
import { jsxChildren } from './jsx-children.ts';

const TRANSPARENT_WRAPPERS = new Set(['ParenthesizedExpression', 'TSAsExpression']);
const FUNCTION_NODES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'ObjectMethod',
  'ClassMethod',
]);

function unwrapExpression(node: AstNode | undefined): AstNode | undefined {
  let current = node;
  while (current && TRANSPARENT_WRAPPERS.has(current.type)) {
    current = asAstNode(current['expression']);
  }
  return current;
}

export function findAncestors(ast: AstNode, target: AstNode): AstNode[] {
  let found: AstNode[] | undefined;

  function walk(node: unknown, trail: AstNode[]) {
    const astN = asAstNode(node);
    if (!astN || found) return;

    if (astN === target) {
      found = trail.filter((n) => !TRANSPARENT_WRAPPERS.has(n.type));
      return;
    }

    const nextTrail = [...trail, astN];
    for (const key of Object.keys(astN)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      const child = astN[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item, nextTrail);
      } else if (child !== undefined && typeof child === 'object') {
        walk(child, nextTrail);
      }
    }
  }

  walk(ast['program'], []);
  return found ?? [];
}

function isMapCallArgument(ancestors: readonly AstNode[], fnIndex: number): boolean {
  const fnNode = ancestors[fnIndex];
  const parent = ancestors[fnIndex - 1];
  if (!fnNode || !parent) return false;
  if (parent.type !== 'CallExpression' && parent.type !== 'OptionalCallExpression') return false;

  const callee = asAstNode(parent['callee']);
  const prop = asAstNode(callee?.['property']);
  if (prop?.['name'] !== 'map') return false;

  const args = Array.isArray(parent['arguments']) ? parent['arguments'] : [];
  return args.some((arg) => unwrapExpression(asAstNode(arg)) === fnNode);
}

function enclosingFunctionIndex(ancestors: readonly AstNode[]): number {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (node && FUNCTION_NODES.has(node.type)) return i;
  }
  return -1;
}

export function isElementLoopRoot(ast: AstNode, target: AstNode): boolean {
  const ancestors = findAncestors(ast, target);
  const parent = ancestors[ancestors.length - 1];
  if (!parent) return false;

  if (parent.type === 'ArrowFunctionExpression') {
    const body = unwrapExpression(asAstNode(parent['body']));
    if (body === target) {
      const fnIdx = ancestors.length - 1;
      return isMapCallArgument(ancestors, fnIdx);
    }
  }

  if (parent.type === 'ReturnStatement') {
    const fnIdx = enclosingFunctionIndex(ancestors);
    return fnIdx >= 0 && isMapCallArgument(ancestors, fnIdx);
  }

  return false;
}

/**
 * Checks whether an element can be removed, duplicated, or used as a sibling insertion reference (R-SE-21).
 */
export function checkElementStructureGuard(
  ast: AstNode,
  target: AstNode,
  loc: string,
): Result<void> {
  const ancestors = findAncestors(ast, target);
  const parent = ancestors[ancestors.length - 1];
  if (!parent) {
    return err({ code: 'E023', params: { reason: 'rootElement', loc } });
  }

  if (parent.type === 'ArrowFunctionExpression') {
    const body = unwrapExpression(asAstNode(parent['body']));
    if (body === target) {
      const fnIdx = ancestors.length - 1;
      const reason = isMapCallArgument(ancestors, fnIdx) ? 'loopRoot' : 'rootElement';
      return err({ code: 'E023', params: { reason, loc } });
    }
  }

  if (parent.type === 'ReturnStatement') {
    const fnIdx = enclosingFunctionIndex(ancestors);
    const reason = fnIdx >= 0 && isMapCallArgument(ancestors, fnIdx) ? 'loopRoot' : 'rootElement';
    return err({ code: 'E023', params: { reason, loc } });
  }

  if (parent.type === 'VariableDeclarator') {
    const init = unwrapExpression(asAstNode(parent['init']));
    if (init === target) {
      return err({ code: 'E023', params: { reason: 'rootElement', loc } });
    }
  }

  if (parent.type !== 'JSXElement' && parent.type !== 'JSXFragment') {
    return err({ code: 'E023', params: { reason: 'expressionChild', loc } });
  }

  return ok(undefined);
}

/**
 * Checks whether a parent element can receive a child insertion (R-SE-21 componentSlot).
 */
export function checkChildInsertGuard(parentNode: AstNode, loc: string): Result<void> {
  const children = jsxChildren(parentNode);
  for (const child of children) {
    if (child.type === 'JSXExpressionContainer') {
      const expr = unwrapExpression(asAstNode(child['expression']));
      if (expr?.type === 'Identifier' && expr['name'] === 'children') {
        return err({ code: 'E023', params: { reason: 'componentSlot', loc } });
      }
    }
  }
  return ok(undefined);
}
