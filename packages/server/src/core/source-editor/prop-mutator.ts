// Static AST reader & MagicString mutator for component JSX props (TK-51).
import type { Result, SetPropEdit, SetPropValue } from '@kumicraft/shared';
import { err, isValidSettablePropName, ok } from '@kumicraft/shared';
import type MagicString from 'magic-string';

import { asAstNode, type AstNode } from './ast-helpers.ts';
import { removeAttribute } from './source-mutator.ts';

export type ReadPropState =
  | { readonly kind: 'absent' }
  | { readonly kind: 'constant'; readonly value: SetPropValue }
  | { readonly kind: 'expression' };

/** Reads a JSXAttribute's constant value (string/number/boolean literal or shorthand true). */
export function readConstantProp(attr: AstNode | undefined): ReadPropState {
  if (!attr) return { kind: 'absent' };
  const val = asAstNode(attr['value']);
  if (!val) return { kind: 'constant', value: true };
  if (val.type === 'StringLiteral' && typeof val['value'] === 'string') {
    return { kind: 'constant', value: val['value'] };
  }
  if (val.type !== 'JSXExpressionContainer') return { kind: 'expression' };
  const expr = asAstNode(val['expression']);
  if (!expr) return { kind: 'expression' };
  if (expr.type === 'StringLiteral' && typeof expr['value'] === 'string') {
    return { kind: 'constant', value: expr['value'] };
  }
  if (expr.type === 'BooleanLiteral' && typeof expr['value'] === 'boolean') {
    return { kind: 'constant', value: expr['value'] };
  }
  if (expr.type === 'NumericLiteral' && typeof expr['value'] === 'number') {
    return { kind: 'constant', value: expr['value'] };
  }
  if (expr.type === 'UnaryExpression' && expr['operator'] === '-') {
    const arg = asAstNode(expr['argument']);
    if (arg?.type === 'NumericLiteral' && typeof arg['value'] === 'number') {
      return { kind: 'constant', value: -arg['value'] };
    }
  }
  return { kind: 'expression' };
}

function formatPropAttribute(name: string, value: SetPropValue): string {
  if (value === true) return name;
  if (value === false) return `${name}={false}`;
  if (typeof value === 'number') return `${name}={${String(value)}}`;
  if (value.includes('"') || value.includes('\n')) {
    return `${name}={${JSON.stringify(value)}}`;
  }
  return `${name}="${value}"`;
}

function insertNewProp(s: MagicString, code: string, opening: AstNode, attrText: string): void {
  const isSelfClosing = Boolean(opening['selfClosing']);
  const elStart = typeof opening.start === 'number' ? opening.start : 0;
  const elEnd = typeof opening.end === 'number' ? opening.end : code.length;
  let insertPos = elEnd - (isSelfClosing ? 2 : 1);
  while (insertPos > elStart && (code[insertPos - 1] === ' ' || code[insertPos - 1] === '\t')) {
    insertPos--;
  }
  s.appendLeft(insertPos, ` ${attrText}`);
}

export function applySetPropMutation(
  edit: SetPropEdit,
  rawAttrs: readonly unknown[],
  opening: AstNode,
  code: string,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  if (!isValidSettablePropName(edit.name)) {
    return err({ code: 'E023', params: { reason: 'blockedProp', name: edit.name } });
  }
  const existing = rawAttrs
    .map(asAstNode)
    .find((a) => a?.type === 'JSXAttribute' && asAstNode(a['name'])?.['name'] === edit.name);
  const current = readConstantProp(existing);
  if (current.kind === 'expression') {
    return err({ code: 'E023', params: { reason: 'propExpression', name: edit.name } });
  }

  const removeProp = edit.value === undefined || (edit.value === false && edit.required !== true);
  if (removeProp) {
    if (!existing) return ok({ unchanged: true });
    removeAttribute(s, code, existing);
    return ok({});
  }

  const nextVal = edit.value;
  if (nextVal === undefined) return ok({ unchanged: true });
  if (current.kind === 'constant' && current.value === nextVal) {
    return ok({ unchanged: true });
  }
  const formatted = formatPropAttribute(edit.name, nextVal);
  if (existing && typeof existing.start === 'number' && typeof existing.end === 'number') {
    s.overwrite(existing.start, existing.end, formatted);
    return ok({});
  }
  insertNewProp(s, code, opening, formatted);
  return ok({});
}
