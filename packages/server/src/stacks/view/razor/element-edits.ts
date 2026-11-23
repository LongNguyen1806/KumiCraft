// The Inspector's edits on a Razor element (docs/architecture/03c sections 3.3, 4), as text changes
// of the file: only HTML characters are replaced; a part that is C# is refused, never rewritten.
import { err, ok, type Result, type SourceEdit } from '@kumicraft/shared';

import type { Splice } from '../../../kernel/text-view-editor.ts';
import type { RazorDocument, RazorElement } from '../../../lib/razor/markup.ts';
import { attrNamed, readText, soleText } from './element-source.ts';

export type Change = Splice;

/** Text for an HTML attribute value or element text in Razor: `@` doubled, markup escaped. */
export function writeText(value: string, inAttr: boolean): string {
  const escaped = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('@', '@@');
  return inAttr ? escaped.replaceAll('"', '&quot;') : escaped.replaceAll('>', '&gt;');
}

const refuse = (reason: string): Result<Change[]> => err({ code: 'E023', params: { reason } });

/** Where a new attribute goes: after the last attribute, or right after the tag name. */
function attrInsertAt(element: RazorElement): number {
  return element.attrs.at(-1)?.end ?? element.nameEnd;
}

/** Removes an attribute with the space before it. */
function removeAttr(doc: RazorDocument, start: number, end: number): Change {
  let from = start;
  while (from > 0 && /[ \t]/.test(doc.text[from - 1] ?? '')) from -= 1;
  return { start: from, end, text: '' };
}

function setClass(doc: RazorDocument, element: RazorElement, after: string): Result<Change[]> {
  const attrs = attrNamed(element, 'class');
  if (attrs.length > 1) return refuse('duplicateAttr');
  const attr = attrs[0];
  const classes = after.trim().replace(/\s+/g, ' ');
  if (attr === undefined) {
    if (classes === '') return ok([]);
    return ok([
      {
        start: attrInsertAt(element),
        end: attrInsertAt(element),
        text: ` class="${writeText(classes, true)}"`,
      },
    ]);
  }
  const value = attr.value;
  const first = value?.parts[0];
  if (value === undefined || first === undefined) {
    if (classes === '') return ok([removeAttr(doc, attr.start, attr.end)]);
    return ok([{ start: attr.start, end: attr.end, text: `class="${writeText(classes, true)}"` }]);
  }
  if (first.kind === 'code') return refuse('classExpression');
  if (value.parts.length === 1) {
    if (classes === '') return ok([removeAttr(doc, attr.start, attr.end)]);
    return ok([{ start: value.start, end: value.end, text: writeText(classes, true) }]);
  }
  // Written classes before C#: replace them, keep one space before the C# part.
  const rest = doc.text.slice(first.end, value.end);
  const gap = classes === '' || /^\s/.test(rest) ? '' : ' ';
  return ok([{ start: first.start, end: first.end, text: writeText(classes, true) + gap }]);
}

function setText(
  doc: RazorDocument,
  element: RazorElement,
  before: string,
  after: string,
): Result<Change[]> {
  if (element.selfClosing) return refuse('selfClosing');
  const close = element.close;
  if (element.children.length === 0 && close !== undefined) {
    return ok([{ start: element.openEnd, end: close.start, text: writeText(after, false) }]);
  }
  const text = soleText(element);
  if (text === undefined) {
    return refuse(element.children.some((c) => c.kind === 'code') ? 'textExpression' : 'textMixed');
  }
  const raw = doc.text.slice(text.start, text.end);
  const lead = raw.length - raw.trimStart().length;
  const trail = raw.length - raw.trimEnd().length;
  const current = readText(raw.trim());
  if (current !== before && before !== '')
    return err({ code: 'E017', params: { reason: 'valueChanged' } });
  return ok([{ start: text.start + lead, end: text.end - trail, text: writeText(after, false) }]);
}

function setAttribute(
  element: RazorElement,
  name: string,
  after: string | undefined,
): Result<Change[]> {
  const attrs = attrNamed(element, name.toLowerCase());
  if (attrs.length > 1) return refuse('duplicateAttr');
  const attr = attrs[0];
  if (attr === undefined) {
    if (after === undefined) return ok([]);
    const at = attrInsertAt(element);
    return ok([{ start: at, end: at, text: ` ${name}="${writeText(after, true)}"` }]);
  }
  if (attr.value?.parts.some((p) => p.kind === 'code') === true) return refuse('attrExpression');
  if (after === undefined) return ok([{ start: attr.start, end: attr.end, text: '' }]);
  return ok([
    { start: attr.start, end: attr.end, text: `${attr.name}="${writeText(after, true)}"` },
  ]);
}

function setTag(element: RazorElement, tag: string): Result<Change[]> {
  const changes: Change[] = [{ start: element.start + 1, end: element.nameEnd, text: tag }];
  const close = element.close;
  if (close !== undefined) {
    changes.push({ start: close.start + 2, end: close.start + 2 + element.tag.length, text: tag });
  }
  return ok(changes);
}

/** The text changes of one Inspector edit. */
export function razorElementEdit(
  doc: RazorDocument,
  element: RazorElement,
  edit: SourceEdit,
): Result<Change[]> {
  switch (edit.kind) {
    case 'setClassName':
      return setClass(doc, element, edit.after);
    case 'setText':
      return setText(doc, element, edit.before, edit.after);
    case 'setAttribute':
      return setAttribute(element, edit.name, edit.after);
    case 'setFlag': {
      const has = attrNamed(element, edit.name).length > 0;
      if (has === edit.on) return ok([]);
      return edit.on
        ? setAttribute(element, edit.name, '')
        : setAttribute(element, edit.name, undefined);
    }
    case 'setTag':
      return setTag(element, edit.after);
    case 'setTextRun':
    case 'setProp':
      return refuse('notForRazor');
  }
}
