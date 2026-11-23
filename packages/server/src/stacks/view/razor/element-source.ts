// What the Inspector reads of a Razor element (docs/architecture/03c section 4): its classes (the
// written part, the C# part kept), its text, its attributes. C# is shown, never offered for edit.
import { decodeEntities } from '@kumicraft/content';
import {
  type ElementAttributes,
  type ElementClassName,
  type ElementSource,
  type ElementSourceText,
  isValidSettableAttrName,
  type StaticOrString,
} from '@kumicraft/shared';

import {
  inLoop,
  type RazorAttr,
  type RazorDocument,
  type RazorElement,
  VOID_TAGS,
} from '../../../lib/razor/markup.ts';

const MAX_CODE = 200;

export const attrNamed = (element: RazorElement, name: string): RazorAttr[] =>
  element.attrs.filter((a) => a.name.toLowerCase() === name);

const slice = (doc: RazorDocument, from: number, to: number): string => doc.text.slice(from, to);

/** Written Razor text as shown: `@@` is one `@`, entities are characters. */
export const readText = (raw: string): string => decodeEntities(raw.replaceAll('@@', '@'));

function classNameOf(doc: RazorDocument, element: RazorElement): ElementClassName {
  const attrs = attrNamed(element, 'class');
  if (attrs.length > 1) return { kind: 'duplicate' };
  const value = attrs[0]?.value;
  if (attrs.length === 0) return { kind: 'none' };
  if (value === undefined) return { kind: 'static', value: '' };
  const [first, ...rest] = value.parts;
  if (first === undefined) return { kind: 'static', value: '' };
  if (first.kind === 'code') {
    return { kind: 'expression', code: slice(doc, value.start, value.end).slice(0, MAX_CODE) };
  }
  if (rest.length === 0)
    return { kind: 'static', value: readText(slice(doc, first.start, first.end)) };
  // `class="card p-4 @(on ? "on" : "")"`: the written classes are edited, the C# kept as it is.
  return {
    kind: 'templateStatic',
    value: readText(slice(doc, first.start, first.end)).trimEnd(),
    rest: slice(doc, first.end, value.end).slice(0, MAX_CODE),
  };
}

/** The only text of an element, if it has nothing else inside (whitespace aside). */
export function soleText(element: RazorElement): { start: number; end: number } | undefined {
  const texts = element.children.filter((c) => c.kind === 'text');
  if (texts.length !== 1 || element.children.length !== 1) return undefined;
  return texts[0];
}

function textOf(doc: RazorDocument, element: RazorElement): ElementSourceText {
  if (element.selfClosing || VOID_TAGS.has(element.tag)) return { kind: 'selfClosing' };
  const meaningful = element.children.filter(
    (c) => c.kind !== 'comment' && !(c.kind === 'text' && slice(doc, c.start, c.end).trim() === ''),
  );
  if (meaningful.length === 0) return { kind: 'none' };
  const only = meaningful[0];
  if (meaningful.length === 1 && only?.kind === 'text') {
    return { kind: 'static', value: readText(slice(doc, only.start, only.end).trim()) };
  }
  if (meaningful.length === 1 && only?.kind === 'code') {
    return { kind: 'expression', code: slice(doc, only.start, only.end).slice(0, MAX_CODE) };
  }
  if (meaningful.some((c) => c.kind === 'code' || c.kind === 'text')) return { kind: 'mixed' };
  return { kind: 'none' };
}

function attrValue(doc: RazorDocument, attr: RazorAttr): StaticOrString {
  const value = attr.value;
  if (value === undefined) return { kind: 'static', value: '' };
  if (value.parts.every((p) => p.kind === 'static')) {
    return { kind: 'static', value: readText(slice(doc, value.start, value.end)) };
  }
  return { kind: 'expression', code: slice(doc, value.start, value.end).slice(0, MAX_CODE) };
}

function attributesOf(doc: RazorDocument, element: RazorElement): ElementAttributes {
  const out: ElementAttributes = {};
  for (const attr of element.attrs) {
    const name = attr.name;
    if (name.startsWith('data-rc-') || !isValidSettableAttrName(name)) continue;
    out[name] = attrValue(doc, attr);
  }
  return out;
}

/** The Inspector's view of one element. */
export function razorElementSource(
  doc: RazorDocument,
  element: RazorElement,
  loc: string,
  fileHash: string,
): ElementSource {
  const free = attrNamed(element, 'data-rc-free').length > 0;
  return {
    loc,
    tag: element.tag,
    fileHash,
    className: classNameOf(doc, element),
    text: textOf(doc, element),
    attributes: attributesOf(doc, element),
    inLoop: inLoop(doc, element),
    ...(free ? { free: true } : {}),
  };
}
