// Mixed JSX text run extraction and single-run mutation (K9.8-1 TK-78).
import type { Result, SetTextRunEdit, TextRunNode } from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';
import type MagicString from 'magic-string';

import { asAstNode, type AstNode, getJsxTagName } from '../../../lib/ast-helpers.ts';
import { decodeHtmlEntities, encodeJsxText, normalizeJsxWhitespace } from './text-reader.ts';

function readDataIconAttr(opening: AstNode): string | undefined {
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  for (const item of attrs) {
    const attr = asAstNode(item);
    if (attr?.type !== 'JSXAttribute') continue;
    if (asAstNode(attr['name'])?.['name'] !== 'data-icon') continue;
    const val = asAstNode(attr['value']);
    if (val?.type === 'StringLiteral' && typeof val['value'] === 'string') {
      return val['value'];
    }
  }
  return undefined;
}

function isSpaceExpression(expr: AstNode | undefined): boolean {
  return (
    expr?.type === 'StringLiteral' &&
    typeof expr['value'] === 'string' &&
    /^\s+$/.test(expr['value'])
  );
}

function formatExprPreview(expr: AstNode | undefined, code: string | undefined): string {
  if (expr === undefined) return 'expr';
  if (typeof expr['name'] === 'string') return expr['name'];
  if (code !== undefined && typeof expr.start === 'number' && typeof expr.end === 'number') {
    return code.slice(expr.start, expr.end).slice(0, 80);
  }
  return expr.type;
}

function collectEditableTextNodes(children: readonly unknown[]): AstNode[] {
  const result: AstNode[] = [];
  for (const rawChild of children) {
    const child = asAstNode(rawChild);
    if (child?.type !== 'JSXText') continue;
    const rawVal = typeof child['value'] === 'string' ? child['value'] : '';
    if (normalizeJsxWhitespace(rawVal).length > 0) {
      result.push(child);
    }
  }
  return result;
}

export function extractMixedRuns(
  children: readonly unknown[],
  code?: string,
): readonly TextRunNode[] {
  const runs: TextRunNode[] = [];
  let textIndex = 0;

  for (const rawChild of children) {
    const child = asAstNode(rawChild);
    if (child === undefined) continue;

    if (child.type === 'JSXText') {
      const rawVal = typeof child['value'] === 'string' ? child['value'] : '';
      const normalized = normalizeJsxWhitespace(rawVal);
      if (normalized.length > 0) {
        runs.push({
          kind: 'text',
          runIndex: textIndex,
          value: decodeHtmlEntities(normalized),
        });
        textIndex += 1;
      }
      continue;
    }

    if (child.type === 'JSXElement') {
      const opening = asAstNode(child['openingElement']);
      const tag = (opening !== undefined ? getJsxTagName(opening) : undefined) ?? 'div';
      const iconName = opening !== undefined ? readDataIconAttr(opening) : undefined;
      runs.push(
        iconName !== undefined ? { kind: 'element', tag, iconName } : { kind: 'element', tag },
      );
      continue;
    }

    if (child.type === 'JSXExpressionContainer') {
      const expr = asAstNode(child['expression']);
      if (isSpaceExpression(expr)) continue;
      runs.push({ kind: 'expression', code: formatExprPreview(expr, code) });
    }
  }

  return runs;
}

export function applySetTextRunMutation(
  edit: SetTextRunEdit,
  targetNode: AstNode,
  opening: AstNode,
  code: string,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  if (opening['selfClosing']) return err({ code: 'E023', params: { reason: 'selfClosing' } });
  const rawChildren = Array.isArray(targetNode['children']) ? targetNode['children'] : [];
  const textNodes = collectEditableTextNodes(rawChildren);
  const targetText = textNodes[edit.index];
  if (targetText === undefined || targetText.start === undefined || targetText.end === undefined) {
    return err({ code: 'E017', params: { reason: 'valueChanged' } });
  }

  const raw = code.slice(targetText.start, targetText.end);
  const currentVisible = decodeHtmlEntities(normalizeJsxWhitespace(raw));
  if (edit.before !== currentVisible) {
    return err({ code: 'E017', params: { reason: 'valueChanged' } });
  }
  if (currentVisible === edit.after) return ok({ unchanged: true });

  const leading = /^\s*/.exec(raw)?.[0] ?? '';
  const trailing = /\s*$/.exec(raw)?.[0] ?? '';
  s.overwrite(
    targetText.start,
    targetText.end,
    `${leading}${encodeJsxText(edit.after)}${trailing}`,
  );
  return ok({});
}
