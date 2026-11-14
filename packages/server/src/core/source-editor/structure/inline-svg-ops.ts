// Text-edit builders for inline wrapText (TK-3) and SVG child replacement replaceSvg (TK-6).
import type { ReplaceSvgEdit, Result, SvgNodeItem, WrapTextEdit } from '@kumicraft/shared';
import { err, isSafeSvgAttrName, ok, SVG_ALLOWED_TAGS } from '@kumicraft/shared';

import { asAstNode, type AstNode } from '../ast-helpers.ts';
import { decodeHtmlEntities } from '../text-reader.ts';
import { indentOf, type ResolvedElement } from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';

type CharSpan = { readonly rawStart: number; readonly rawEnd: number };

const ENTITY_RE = /^&(#?[a-zA-Z0-9]+);/;
const ALLOWED_SVG_SET = new Set<string>(SVG_ALLOWED_TAGS);
const SVG_ATTR_REMAP: Readonly<Record<string, string>> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};

function scanLineRanges(raw: string): readonly { readonly start: number; readonly end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let lineStart = 0;
  for (let i = 0; i <= raw.length; i++) {
    if (i === raw.length || raw[i] === '\n') {
      const lineEnd = i > lineStart && raw[i - 1] === '\r' ? i - 1 : i;
      let tStart = lineStart;
      while (tStart < lineEnd && (raw[tStart] === ' ' || raw[tStart] === '\t')) tStart++;
      let tEnd = lineEnd;
      while (tEnd > tStart && (raw[tEnd - 1] === ' ' || raw[tEnd - 1] === '\t')) tEnd--;
      if (tStart < tEnd) ranges.push({ start: tStart, end: tEnd });
      lineStart = i + 1;
    }
  }
  return ranges;
}

function mapNormalizedChars(raw: string): readonly CharSpan[] {
  const ranges = scanLineRanges(raw);
  const chars: CharSpan[] = [];
  for (let r = 0; r < ranges.length; r++) {
    const seg = ranges[r];
    if (seg === undefined) continue;
    if (r > 0) {
      const prev = ranges[r - 1];
      chars.push({ rawStart: prev?.end ?? seg.start, rawEnd: seg.start });
    }
    let i = seg.start;
    while (i < seg.end) {
      if (raw[i] === '&') {
        const match = ENTITY_RE.exec(raw.slice(i, seg.end)) ?? undefined;
        if (match !== undefined) {
          const decoded = decodeHtmlEntities(match[0]);
          if (decoded !== match[0]) {
            for (let k = 0; k < decoded.length; k++) {
              chars.push({ rawStart: i, rawEnd: i + match[0].length });
            }
            i += match[0].length;
            continue;
          }
        }
      }
      chars.push({ rawStart: i, rawEnd: i + 1 });
      i += 1;
    }
  }
  return chars;
}

function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function buildWrapTextInlineEdits(
  code: string,
  resolved: ResolvedElement,
  edit: WrapTextEdit,
): Result<readonly TextEdit[]> {
  if (resolved.opening['selfClosing']) {
    return err({ code: 'E023', params: { reason: 'selfClosing' } });
  }
  const rawChildren = Array.isArray(resolved.node['children']) ? resolved.node['children'] : [];
  const children = rawChildren.map(asAstNode).filter((c): c is AstNode => c !== undefined);
  if (children.some((c) => c.type === 'JSXExpressionContainer')) {
    return err({ code: 'E023', params: { reason: 'textExpression' } });
  }
  if (children.length !== 1 || children[0]?.type !== 'JSXText') {
    return err({ code: 'E023', params: { reason: 'textMixed' } });
  }
  const textNode = children[0];
  if (textNode.start === undefined || textNode.end === undefined) {
    return err({ code: 'E023', params: { reason: 'textMixed' } });
  }
  const raw = code.slice(textNode.start, textNode.end);
  const chars = mapNormalizedChars(raw);
  if (edit.start < 0 || edit.end <= edit.start || edit.end > chars.length) {
    return err({ code: 'E016', params: { reason: 'invalidRange' } });
  }
  const firstChar = chars[edit.start];
  const lastChar = chars[edit.end - 1];
  if (firstChar === undefined || lastChar === undefined) {
    return err({ code: 'E016', params: { reason: 'invalidRange' } });
  }
  const rawStart = firstChar.rawStart;
  const rawEnd = lastChar.rawEnd;
  const selectedRaw = raw.slice(rawStart, rawEnd);
  const clsAttr =
    edit.wrapper.className !== undefined && edit.wrapper.className.length > 0
      ? ` className="${escapeAttr(edit.wrapper.className)}"`
      : '';
  const wrapped = `<${edit.wrapper.tag}${clsAttr}>${selectedRaw}</${edit.wrapper.tag}>`;
  return ok([
    {
      start: textNode.start + rawStart,
      end: textNode.start + rawEnd,
      text: wrapped,
      mark: 0,
    },
  ]);
}

function formatSvgChild(item: SvgNodeItem, childIndent: string): Result<string> {
  const [tag, attrs] = item;
  if (!ALLOWED_SVG_SET.has(tag)) {
    return err({ code: 'E023', params: { reason: 'invalidSvgTag', tag } });
  }
  const parts: string[] = [];
  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    if (rawKey === 'key') continue;
    // Checked again here, not only in the schema: the name is written verbatim into JSX.
    if (!isSafeSvgAttrName(rawKey)) {
      return err({ code: 'E023', params: { reason: 'blockedAttribute', name: rawKey } });
    }
    const key = SVG_ATTR_REMAP[rawKey] ?? rawKey;
    parts.push(`${key}="${escapeAttr(String(rawVal))}"`);
  }
  const attrStr = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  return ok(`${childIndent}<${tag}${attrStr} />`);
}

function buildDataIconAttrEdit(
  opening: AstNode,
  code: string,
  iconName: string,
): TextEdit | undefined {
  const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  const attrs = rawAttrs
    .map(asAstNode)
    .filter((a): a is AstNode => a !== undefined && a.type === 'JSXAttribute');
  const existing = attrs.find((a) => asAstNode(a['name'])?.['name'] === 'data-icon');
  const nextVal = `"${escapeAttr(iconName)}"`;
  if (existing !== undefined) {
    const valNode = asAstNode(existing['value']);
    if (valNode?.start !== undefined && valNode.end !== undefined) {
      return { start: valNode.start, end: valNode.end, text: nextVal };
    }
    if (existing.end !== undefined) {
      return { start: existing.end, end: existing.end, text: `=${nextVal}` };
    }
  }
  if (opening.end === undefined) return undefined;
  const selfClosing = Boolean(opening['selfClosing']);
  let pos = opening.end - (selfClosing ? 2 : 1);
  while (pos > 0 && (code[pos - 1] === ' ' || code[pos - 1] === '\t')) pos--;
  return { start: pos, end: pos, text: ` data-icon=${nextVal}` };
}

export function buildReplaceSvgEdits(
  code: string,
  nl: '\r\n' | '\n',
  resolved: ResolvedElement,
  edit: ReplaceSvgEdit,
): Result<readonly TextEdit[]> {
  const indent = indentOf(code, resolved.start);
  const childIndent = `${indent}  `;
  const lines: string[] = [];
  for (const item of edit.icon.node) {
    const formatted = formatSvgChild(item, childIndent);
    if (!formatted.ok) return formatted;
    lines.push(formatted.value);
  }
  const childrenBlock = `${nl}${lines.join(nl)}${nl}${indent}`;
  const edits: TextEdit[] = [];
  const attrEdit = buildDataIconAttrEdit(resolved.opening, code, edit.icon.name);
  if (attrEdit !== undefined) edits.push(attrEdit);

  const openEnd = resolved.opening.end;
  if (openEnd === undefined) {
    return err({ code: 'E023', params: { reason: 'invalidSvgNode' } });
  }
  if (resolved.opening['selfClosing']) {
    edits.push({
      start: openEnd - 2,
      end: openEnd,
      text: `>${childrenBlock}</svg>`,
    });
    return ok(edits);
  }
  const closingEl = asAstNode(resolved.node['closingElement']);
  if (closingEl?.start === undefined) {
    return err({ code: 'E023', params: { reason: 'invalidSvgNode' } });
  }
  edits.push({ start: openEnd, end: closingEl.start, text: childrenBlock });
  return ok(edits);
}
