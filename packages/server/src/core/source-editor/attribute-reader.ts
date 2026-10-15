// Reading and analyzing JSX attributes (R-SE-03, R-SE-04).
import type {
  EditableAttr,
  ElementAttributes,
  ElementClassName,
  StaticOrString,
} from '@reactcraft/shared';
import { EDITABLE_ATTRS } from '@reactcraft/shared';

import type { AstNode } from './ast-helpers.ts';
import { asAstNode } from './ast-helpers.ts';

/**
 * Extracts a StaticOrString from a JSXAttribute node.
 */
export function extractStaticOrString(attr: AstNode, code: string): StaticOrString {
  const valueNode = asAstNode(attr['value']);
  if (!valueNode) {
    return { kind: 'expression', code: 'true' };
  }

  // e.g. attr="hello" or attr='hello'
  if (valueNode.type === 'StringLiteral' && typeof valueNode['value'] === 'string') {
    return { kind: 'static', value: valueNode['value'] };
  }

  // e.g. attr={"hello"} or attr={'hello'} or attr={`hello`} or attr={expr}
  if (valueNode.type === 'JSXExpressionContainer') {
    const expr = asAstNode(valueNode['expression']);
    if (expr?.type === 'StringLiteral' && typeof expr['value'] === 'string') {
      return { kind: 'static', value: expr['value'] };
    }
    if (expr?.type === 'TemplateLiteral') {
      const expressions = Array.isArray(expr['expressions']) ? expr['expressions'] : [];
      const quasis = Array.isArray(expr['quasis']) ? expr['quasis'] : [];
      if (expressions.length === 0 && quasis.length === 1) {
        const quasi = asAstNode(quasis[0]);
        const quasiObj =
          typeof quasi?.['value'] === 'object' && Boolean(quasi['value'])
            ? (quasi['value'] as Record<string, unknown>)
            : undefined;
        if (typeof quasiObj?.['raw'] === 'string') {
          return { kind: 'static', value: quasiObj['raw'] };
        }
      }
    }

    const start = typeof expr?.start === 'number' ? expr.start : 0;
    const end = typeof expr?.end === 'number' ? expr.end : code.length;
    const raw = code.slice(start, end);
    return {
      kind: 'expression',
      code: raw.slice(0, 200),
    };
  }

  const start = typeof valueNode.start === 'number' ? valueNode.start : 0;
  const end = typeof valueNode.end === 'number' ? valueNode.end : code.length;
  const raw = code.slice(start, end);
  return {
    kind: 'expression',
    code: raw.slice(0, 200),
  };
}

/**
 * Reads className attribute from opening element (R-SE-04).
 */
export function readClassName(attributes: readonly unknown[], code: string): ElementClassName {
  const classAttrs = attributes.map(asAstNode).filter((a): a is AstNode => {
    if (!a || a.type !== 'JSXAttribute') return false;
    const nameNode = asAstNode(a['name']);
    return nameNode?.['name'] === 'className';
  });

  if (classAttrs.length > 1) {
    return { kind: 'duplicate' };
  }

  const classAttr = classAttrs[0];
  if (!classAttr) {
    return { kind: 'none' };
  }

  return extractStaticOrString(classAttr, code);
}

/**
 * Reads editable attributes (href, src, alt, placeholder, type) from opening element.
 */
export function readEditableAttributes(
  attributes: readonly unknown[],
  code: string,
): ElementAttributes {
  const result: Record<EditableAttr, StaticOrString | undefined> = {
    href: undefined,
    src: undefined,
    alt: undefined,
    placeholder: undefined,
    type: undefined,
  };
  const astAttrs = attributes
    .map(asAstNode)
    .filter((a): a is AstNode => a !== undefined && a.type === 'JSXAttribute');

  for (const name of EDITABLE_ATTRS) {
    const matching = astAttrs.filter((a) => {
      const nameNode = asAstNode(a['name']);
      return nameNode?.['name'] === name;
    });

    if (matching.length === 1 && matching[0]) {
      result[name] = extractStaticOrString(matching[0], code);
    } else if (matching.length > 1) {
      result[name] = {
        kind: 'expression',
        code: 'duplicate',
      };
    }
  }

  return result;
}
