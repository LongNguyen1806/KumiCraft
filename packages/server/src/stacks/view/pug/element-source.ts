// What the Inspector reads of a Pug element (docs/architecture/03d section 4): its classes
// (`.shorthand` and `class="…"`), its text (on the tag's line or a lone `|` line), its attributes.
// Code (`= x`, `#{x}`, `class=x`) is shown, never offered for edit.
import { decodeEntities } from '@kumicraft/content';
import {
  type ElementAttributes,
  type ElementClassName,
  type ElementSource,
  type ElementSourceText,
  isValidSettableAttrName,
  type StaticOrString,
} from '@kumicraft/shared';

import type { PugAttr, PugDocument, PugElement } from '../../../lib/pug/markup.ts';

const MAX_CODE = 200;

/** The value of a Pug attribute written as a plain string (`"x"`, `'x'`); else undefined. */
export function stringValue(val: string | true): string | undefined {
  if (val === true) return '';
  const m = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/s.exec(val);
  if (!m) return undefined;
  return (m[2] ?? '').replace(/\\(.)/g, '$1');
}

/** Text as shown: Pug's `\#{` is a written `#{`, entities are characters. */
export const readPugText = (raw: string): string =>
  decodeEntities(raw.replaceAll('\\#{', '#{').replaceAll('\\#[', '#['));

export const attrsNamed = (el: PugElement, name: string): PugAttr[] =>
  el.attrs.filter((a) => a.name.toLowerCase() === name);

function classNameOf(el: PugElement): ElementClassName {
  const shorthand = el.parts.filter((p) => p.kind === 'class').map((p) => p.name);
  const attrs = attrsNamed(el, 'class');
  if (attrs.length > 1) return { kind: 'duplicate' };
  const attr = attrs[0];
  if (attr !== undefined && stringValue(attr.val) === undefined) {
    return { kind: 'expression', code: String(attr.val).slice(0, MAX_CODE) };
  }
  const written = attr === undefined ? [] : (stringValue(attr.val) ?? '').split(/\s+/);
  const all = [...shorthand, ...written].filter((c) => c !== '');
  return all.length === 0 && attr === undefined
    ? { kind: 'none' }
    : { kind: 'static', value: all.join(' ') };
}

/** The lone `| text` line under an element, if that is all it holds. */
export function pipeLine(
  doc: PugDocument,
  el: PugElement,
): { start: number; end: number } | undefined {
  const lines = el.childLines.filter((n) => doc.lines[n - 1]?.blank !== true);
  const only = lines[0];
  if (lines.length !== 1 || only === undefined || doc.lines[only - 1]?.kind !== 'text')
    return undefined;
  const start = doc.lineStarts[only - 1] ?? 0;
  const end = (doc.lineStarts[only] ?? doc.text.length + 1) - 1;
  const line = doc.text.slice(start, end).replace(/\r$/, '');
  const bar = line.indexOf('| ');
  if (bar < 0 || line.slice(0, bar).trim() !== '') return undefined;
  return { start: start + bar + 2, end: start + line.length };
}

function textOf(doc: PugDocument, el: PugElement): ElementSourceText {
  if (el.selfClosing) return { kind: 'selfClosing' };
  const inline = el.inline;
  if (inline.kind === 'text') return { kind: 'static', value: readPugText(inline.value.trim()) };
  if (inline.kind === 'code') {
    return {
      kind: 'expression',
      code: doc.text.slice(inline.start, inline.end).slice(0, MAX_CODE),
    };
  }
  if (inline.kind === 'mixed') return { kind: 'mixed' };
  const pipe = pipeLine(doc, el);
  if (pipe !== undefined) {
    const raw = doc.text.slice(pipe.start, pipe.end);
    return /#\{|#\[|!\{/.test(raw.replaceAll('\\#', ''))
      ? { kind: 'mixed' }
      : { kind: 'static', value: readPugText(raw.trim()) };
  }
  const hasText = el.childLines.some((n) => doc.lines[n - 1]?.kind === 'text');
  return hasText ? { kind: 'mixed' } : { kind: 'none' };
}

function attrValue(attr: PugAttr): StaticOrString {
  const value = stringValue(attr.val);
  if (value !== undefined) return { kind: 'static', value };
  return { kind: 'expression', code: String(attr.val).slice(0, MAX_CODE) };
}

function attributesOf(el: PugElement): ElementAttributes {
  const out: ElementAttributes = {};
  for (const attr of el.attrs) {
    if (attr.name.startsWith('data-rc-') || !isValidSettableAttrName(attr.name)) continue;
    out[attr.name] = attrValue(attr);
  }
  return out;
}

/** The Inspector's view of one Pug element. */
export function pugElementSource(
  doc: PugDocument,
  el: PugElement,
  loc: string,
  fileHash: string,
): ElementSource {
  const free = attrsNamed(el, 'data-rc-free').length > 0;
  return {
    loc,
    tag: el.tag,
    fileHash,
    className: classNameOf(el),
    text: textOf(doc, el),
    attributes: attributesOf(el),
    inLoop: el.loop,
    ...(free ? { free: true } : {}),
  };
}
