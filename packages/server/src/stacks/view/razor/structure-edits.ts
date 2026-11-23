// Structure edits on a .cshtml (docs/architecture/03c sections 3.3, 4): insert a block, remove,
// duplicate, move, wrap, unwrap. Each is a set of text changes of one file; an element is never
// moved across C# blocks (`@if`, `@foreach`), whose braces would no longer match.
import { parseBlockJsx, renderRazor, TreeParseError } from '@kumicraft/content';
import { err, ok, type Result, type StylingReport } from '@kumicraft/shared';

import type { RazorDocument, RazorElement } from '../../../lib/razor/markup.ts';
import type { Change } from './element-edits.ts';

export const elementEnd = (el: RazorElement): number => el.close?.end ?? el.openEnd;

const lineStart = (text: string, at: number): number => text.lastIndexOf('\n', at - 1) + 1;

/** The whitespace before `at` on its line. */
export function indentAt(text: string, at: number): string {
  const start = lineStart(text, at);
  const before = text.slice(start, at);
  return /^\s*$/.test(before) ? before : (/^\s*/.exec(before)?.[0] ?? '');
}

/** The span of an element with its own line, when it is alone on it. */
export function wholeLines(text: string, el: RazorElement): { start: number; end: number } {
  const start = lineStart(text, el.start);
  const end = elementEnd(el);
  const lineEnd = text.indexOf('\n', end);
  const after = text.slice(end, lineEnd < 0 ? text.length : lineEnd);
  if (/\S/.test(text.slice(start, el.start)) || /\S/.test(after)) return { start: el.start, end };
  return { start, end: lineEnd < 0 ? text.length : lineEnd + 1 };
}

export type Where = 'before' | 'after' | 'start' | 'end';

const onlySpaces = (text: string): boolean => /^[ \t]*$/.test(text);

/**
 * The change that puts `markup` (already laid out for the indentation of its place) next to or
 * inside `ref`, on its own line, keeping the lines around it as they were laid out.
 */
export function insertNear(
  doc: RazorDocument,
  ref: RazorElement,
  where: Where,
  markup: (indent: string) => string,
  unit: string,
  newline: string,
): Result<Change> {
  const text = doc.text;
  const own = indentAt(text, ref.start);
  const startsLine = onlySpaces(text.slice(lineStart(text, ref.start), ref.start));
  if (where === 'before') {
    const body = markup(own);
    const textOut = startsLine ? `${body}${newline}${own}` : `${body} `;
    return ok({ start: ref.start, end: ref.start, text: textOut });
  }
  if (where === 'after') {
    const at = elementEnd(ref);
    return ok({ start: at, end: at, text: `${newline}${own}${markup(own)}` });
  }
  const close = ref.close;
  if (close === undefined) return err({ code: 'E016', params: { reason: 'noChildrenTag' } });
  const inner = own + unit;
  const closeOnOwnLine = onlySpaces(text.slice(lineStart(text, close.start), close.start));
  if (where === 'start') {
    const empty = text.slice(ref.openEnd, close.start).trim() === '';
    const tail = empty && !closeOnOwnLine ? `${newline}${own}` : '';
    return ok({
      start: ref.openEnd,
      end: ref.openEnd,
      text: `${newline}${inner}${markup(inner)}${tail}`,
    });
  }
  if (closeOnOwnLine) {
    const at = lineStart(text, close.start);
    return ok({ start: at, end: at, text: `${inner}${markup(inner)}${newline}` });
  }
  return ok({
    start: close.start,
    end: close.start,
    text: `${newline}${inner}${markup(inner)}${newline}${own}`,
  });
}

/** The indentation unit of the file (its first indented line), four spaces by default. */
export function indentUnit(text: string): string {
  const found = /\n([ \t]+)\S/.exec(text)?.[1];
  if (found === undefined) return '    ';
  return found.startsWith('\t') ? '\t' : ' '.repeat(Math.min(found.length, 4));
}

/** A library block (static JSX) as Razor markup at an indentation. */
export function blockMarkup(
  jsx: string,
  indent: string,
  unit: string,
  newline: string,
): Result<string> {
  try {
    return ok(renderRazor(parseBlockJsx(jsx), indent, unit, newline));
  } catch (cause: unknown) {
    if (cause instanceof TreeParseError) return err({ code: 'E016', params: { reason: 'notJsx' } });
    throw cause;
  }
}

/** Same C# block: an element can move or be grouped only inside the block it is in. */
export function sameBlock(a: RazorElement, b: RazorElement): boolean {
  return a.block === b.block;
}

/** The innermost element that holds `el`, if any. */
export function parentOf(doc: RazorDocument, el: RazorElement): RazorElement | undefined {
  let best: RazorElement | undefined;
  for (const other of doc.elements) {
    if (other === el || other.close === undefined) continue;
    if (other.openEnd <= el.start && elementEnd(el) <= other.close.start) {
      if (best === undefined || other.start > best.start) best = other;
    }
  }
  return best;
}

const WRAP: Record<'bootstrap' | 'tailwind', Record<'row' | 'column' | 'grid', string>> = {
  tailwind: {
    row: 'flex flex-row gap-4',
    column: 'flex flex-col gap-4',
    grid: 'grid grid-cols-2 gap-4',
  },
  bootstrap: {
    row: 'd-flex flex-row gap-3',
    column: 'd-flex flex-column gap-3',
    grid: 'row row-cols-2 g-3',
  },
};
const WRAP_STYLE: Record<'row' | 'column' | 'grid', string> = {
  row: 'display:flex;flex-direction:row;gap:1rem',
  column: 'display:flex;flex-direction:column;gap:1rem',
  grid: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem',
};

/** The wrapper's start tag in the project's own style system. */
export function wrapperTag(
  styling: StylingReport | undefined,
  kind: 'row' | 'column' | 'grid',
): string {
  const ids = new Set(styling?.systems.map((s) => s.id) ?? []);
  if (ids.has('tailwind')) return `<div class="${WRAP.tailwind[kind]}">`;
  if (ids.has('bootstrap')) return `<div class="${WRAP.bootstrap[kind]}">`;
  return `<div style="${WRAP_STYLE[kind]}">`;
}
