// The Inspector's edits on a Pug element (docs/architecture/03d section 4): text changes on its tag
// line, keeping how the user writes it (`.card` stays shorthand, `class="…"` stays an attribute).
// A part that is code is refused, never rewritten.
import { err, ok, type Result, type SourceEdit } from '@kumicraft/shared';

import type { Splice } from '../../../kernel/text-view-editor.ts';
import type { PugAttr, PugDocument, PugElement } from '../../../lib/pug/markup.ts';
import { attrsNamed, pipeLine, readPugText, stringValue } from './element-source.ts';

/** A class Pug's `.name` shorthand can write. */
const SHORTHAND = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;

const refuse = (reason: string): Result<Splice[]> => err({ code: 'E023', params: { reason } });

/** Text on a Pug line: markup escaped (Pug writes it as is), interpolation markers escaped. */
export function pugText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('#{', '\\#{')
    .replaceAll('#[', '\\#[')
    .replaceAll('!{', '\\!{');
}

const literal = (value: string): string => JSON.stringify(value);

/** End of the selector written before the attributes (`div#a.b` of `div#a.b(x=1).c`). */
function selectorEnd(el: PugElement): number {
  const before = el.parts.filter((p) => el.attrsSpan === undefined || p.end <= el.attrsSpan.start);
  return before.at(-1)?.end ?? el.start;
}

/** Removes one attribute and the separator next to it (or the whole `(…)` when it is the last). */
function removeAttr(el: PugElement, attr: PugAttr): Splice {
  const span = el.attrsSpan;
  const others = el.attrs.filter(
    (a) => a !== attr && span !== undefined && a.start > span.start && a.end < span.end,
  );
  if (span !== undefined && others.length === 0)
    return { start: span.start, end: span.end, text: '' };
  const index = el.attrs.indexOf(attr);
  const prev = el.attrs[index - 1];
  if (prev !== undefined) return { start: prev.end, end: attr.end, text: '' };
  const next = el.attrs[index + 1];
  return { start: attr.start, end: next?.start ?? attr.end, text: '' };
}

/** Adds or replaces `name=value` (`value` undefined: a bare attribute like `data-rc-free`). */
function putAttr(el: PugElement, name: string, value: string | undefined, at: number): Splice[] {
  const written = value === undefined ? name : `${name}=${literal(value)}`;
  const existing = attrsNamed(el, name.toLowerCase())[0];
  if (existing !== undefined) return [{ start: existing.start, end: existing.end, text: written }];
  const span = el.attrsSpan;
  if (span === undefined) return [{ start: at, end: at, text: `(${written})` }];
  const inside = el.attrs.some((a) => a.start > span.start && a.end < span.end);
  return [{ start: span.end - 1, end: span.end - 1, text: inside ? `, ${written}` : written }];
}

function setClass(doc: PugDocument, el: PugElement, after: string): Result<Splice[]> {
  const attrs = attrsNamed(el, 'class');
  if (attrs.length > 1) return refuse('duplicateAttr');
  const attr = attrs[0];
  if (attr !== undefined && stringValue(attr.val) === undefined) return refuse('classExpression');
  const classes = after.split(/\s+/).filter((c) => c !== '');
  const shorthand = classes.every((c) => SHORTHAND.test(c));
  const end = selectorEnd(el);
  const head = el.parts.filter((p) => p.end <= end && p.kind !== 'class');
  const tagAndIds = head.map((p) => doc.text.slice(p.start, p.end)).join('');
  const dots = shorthand ? classes.map((c) => `.${c}`).join('') : '';
  const needsTag = tagAndIds === '' && dots === '';
  const changes: Splice[] = [
    { start: el.start, end, text: `${needsTag ? 'div' : tagAndIds}${dots}` },
  ];
  // Classes written after the attributes (`a(href).x`) join the others.
  for (const p of el.parts)
    if (p.kind === 'class' && p.start >= end) changes.push({ ...p, text: '' });
  if (shorthand && attr !== undefined) changes.push(removeAttr(el, attr));
  if (!shorthand) changes.push(...putAttr(el, 'class', classes.join(' '), end));
  return ok(changes);
}

/** A block expansion child on the tag's line (`li: a`): text cannot go between them. */
const hasExpansion = (doc: PugDocument, el: PugElement): boolean =>
  doc.elements.some((other) => other.expanded && other.line === el.line && other.start > el.start);

function setText(
  doc: PugDocument,
  el: PugElement,
  before: string,
  after: string,
): Result<Splice[]> {
  if (el.selfClosing) return refuse('selfClosing');
  const inline = el.inline;
  if (inline.kind === 'code') return refuse('textExpression');
  if (inline.kind === 'mixed') return refuse('textMixed');
  if (inline.kind === 'text') {
    if (before !== '' && readPugText(inline.value.trim()) !== before) {
      return err({ code: 'E017', params: { reason: 'valueChanged' } });
    }
    const start = after === '' ? el.headEnd : inline.start;
    return ok([{ start, end: inline.end, text: pugText(after) }]);
  }
  const pipe = pipeLine(doc, el);
  if (pipe !== undefined) return ok([{ start: pipe.start, end: pipe.end, text: pugText(after) }]);
  if (el.childLines.some((n) => doc.lines[n - 1]?.kind === 'text')) return refuse('textMixed');
  if (hasExpansion(doc, el)) return refuse('notForPug');
  return ok(
    after === '' ? [] : [{ start: el.headEnd, end: el.headEnd, text: ` ${pugText(after)}` }],
  );
}

function setAttribute(el: PugElement, name: string, after: string | undefined): Result<Splice[]> {
  const existing = attrsNamed(el, name.toLowerCase());
  if (existing.length > 1) return refuse('duplicateAttr');
  const attr = existing[0];
  if (attr !== undefined && stringValue(attr.val) === undefined) return refuse('attrExpression');
  if (after === undefined) return ok(attr === undefined ? [] : [removeAttr(el, attr)]);
  return ok(putAttr(el, name, after, selectorEnd(el)));
}

function setTag(el: PugElement, tag: string): Result<Splice[]> {
  const part = el.parts.find((p) => p.kind === 'tag');
  if (part !== undefined) return ok([{ start: part.start, end: part.end, text: tag }]);
  return ok(tag === 'div' ? [] : [{ start: el.start, end: el.start, text: tag }]);
}

/** The text changes of one Inspector edit. */
export function pugElementEdit(
  doc: PugDocument,
  el: PugElement,
  edit: SourceEdit,
): Result<Splice[]> {
  switch (edit.kind) {
    case 'setClassName':
      return setClass(doc, el, edit.after);
    case 'setText':
      return setText(doc, el, edit.before, edit.after);
    case 'setAttribute':
      return setAttribute(el, edit.name, edit.after);
    case 'setFlag': {
      const has = attrsNamed(el, edit.name).length > 0;
      if (has === edit.on) return ok([]);
      const attr = attrsNamed(el, edit.name)[0];
      if (!edit.on) return ok(attr === undefined ? [] : [removeAttr(el, attr)]);
      return ok(putAttr(el, edit.name, undefined, selectorEnd(el)));
    }
    case 'setTag':
      return setTag(el, edit.after);
    case 'setTextRun':
    case 'setProp':
      return refuse('notForPug');
  }
}
