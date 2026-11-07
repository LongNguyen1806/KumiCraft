// Reading and analyzing JSX attributes (R-SE-03, R-SE-04).
import type {
  EditableAttr,
  ElementAttributes,
  ElementClassName,
  StaticOrString,
} from '@kumicraft/shared';
import { EDITABLE_ATTRS } from '@kumicraft/shared';

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

const CALL_STATIC_CALLEES = new Set([
  'cn',
  'clsx',
  'classnames',
  'classNames',
  'twMerge',
  'twJoin',
]);

function getCalleeName(calleeNode: AstNode | undefined): string | undefined {
  if (!calleeNode) return undefined;
  if (calleeNode.type === 'Identifier' && typeof calleeNode['name'] === 'string') {
    return calleeNode['name'];
  }
  if (calleeNode.type === 'MemberExpression') {
    const prop = asAstNode(calleeNode['property']);
    if (prop?.type === 'Identifier' && typeof prop['name'] === 'string') {
      return prop['name'];
    }
  }
  return undefined;
}

function extractCallStatic(expr: AstNode, code: string): ElementClassName | undefined {
  if (expr.type !== 'CallExpression') return undefined;
  const calleeNode = asAstNode(expr['callee']);
  const calleeName = getCalleeName(calleeNode);
  if (!calleeName || !CALL_STATIC_CALLEES.has(calleeName)) return undefined;

  const args = Array.isArray(expr['arguments']) ? expr['arguments'].map(asAstNode) : [];
  if (args.length === 0) return undefined;

  const firstArg = args[0];
  let val: string | undefined;
  if (firstArg?.type === 'StringLiteral' && typeof firstArg['value'] === 'string') {
    val = firstArg['value'];
  } else if (firstArg?.type === 'TemplateLiteral') {
    const expressions = Array.isArray(firstArg['expressions']) ? firstArg['expressions'] : [];
    const quasis = Array.isArray(firstArg['quasis']) ? firstArg['quasis'] : [];
    if (expressions.length === 0 && quasis.length === 1) {
      const quasi = asAstNode(quasis[0]);
      const quasiObj =
        typeof quasi?.['value'] === 'object' && Boolean(quasi['value'])
          ? (quasi['value'] as Record<string, unknown>)
          : undefined;
      if (typeof quasiObj?.['raw'] === 'string') {
        val = quasiObj['raw'];
      }
    }
  }

  if (val === undefined) return undefined;

  const calleeStart = typeof calleeNode?.start === 'number' ? calleeNode.start : 0;
  const calleeEnd = typeof calleeNode?.end === 'number' ? calleeNode.end : 0;
  const callee = code.slice(calleeStart, calleeEnd) || calleeName;

  let rest = '';
  if (args.length > 1) {
    const secondArg = args[1];
    const lastArg = args[args.length - 1];
    const restStart = typeof secondArg?.start === 'number' ? secondArg.start : 0;
    const restEnd = typeof lastArg?.end === 'number' ? lastArg.end : code.length;
    rest = code.slice(restStart, restEnd).trim().slice(0, 200);
  }

  return { kind: 'callStatic', value: val, callee, rest };
}

/**
 * `` `p-4 flex ${x}` ``: the first part is editable when it is empty or ends with whitespace, so
 * an edit never cuts a class built with the expression (`` `btn-${variant}` `` stays locked).
 */
function extractTemplateStatic(expr: AstNode, code: string): ElementClassName | undefined {
  if (expr.type !== 'TemplateLiteral') return undefined;
  const expressions = Array.isArray(expr['expressions']) ? expr['expressions'] : [];
  const quasis = Array.isArray(expr['quasis']) ? expr['quasis'].map(asAstNode) : [];
  const first = quasis[0];
  const firstExpr = asAstNode(expressions[0]);
  if (expressions.length === 0 || first === undefined || firstExpr === undefined) return undefined;
  if (typeof first.start !== 'number' || typeof first.end !== 'number') return undefined;
  if (typeof expr.end !== 'number') return undefined;
  const text = code.slice(first.start, first.end);
  if (text.trim() !== '' && !/\s$/.test(text)) return undefined;
  // The value as JavaScript reads it (`\``, `\${` unescaped); the writer escapes it again.
  const parts: unknown = first['value'];
  const cooked: unknown = parts instanceof Object ? Reflect.get(parts, 'cooked') : undefined;
  if (typeof cooked !== 'string') return undefined;
  // From the `${` after the first part to the closing backtick.
  const rest = code
    .slice(first.end, expr.end - 1)
    .trim()
    .slice(0, 200);
  return { kind: 'templateStatic', value: cooked.trim().replace(/\s+/g, ' '), rest };
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

  const valueNode = asAstNode(classAttr['value']);
  if (valueNode?.type === 'JSXExpressionContainer') {
    const expr = asAstNode(valueNode['expression']);
    if (expr) {
      const callStatic = extractCallStatic(expr, code) ?? extractTemplateStatic(expr, code);
      if (callStatic) return callStatic;
    }
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
