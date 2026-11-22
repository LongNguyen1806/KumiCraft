// Direct JSX children of an element or fragment (SPEC-04 R-SE-20).
import { asAstNode, type AstNode } from '../../../../lib/ast-helpers.ts';

export function jsxChildren(node: AstNode): AstNode[] {
  const rawChildren = Array.isArray(node['children']) ? node['children'] : [];
  const result: AstNode[] = [];

  for (const item of rawChildren) {
    const child = asAstNode(item);
    if (!child) continue;

    if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
      result.push(child);
      continue;
    }

    if (child.type === 'JSXExpressionContainer') {
      const expr = asAstNode(child['expression']);
      if (expr && expr.type !== 'JSXEmptyExpression') {
        result.push(child);
      }
      continue;
    }

    if (child.type === 'JSXText') {
      const val = typeof child['value'] === 'string' ? child['value'] : '';
      if (/\S/.test(val)) {
        result.push(child);
      }
    }
  }

  return result;
}
