// Structure edits on a .pug (docs/architecture/03d section 2.1): an element is its tag line and the
// lines indented under it, so insert, remove, duplicate, move, wrap and unwrap are edits of whole
// lines with their indentation set for the new place. An element never moves out of or into an
// `each` / `if` block.
import { posix } from 'node:path';

import { parseBlockJsx, renderPugSource, TreeParseError } from '@kumicraft/content';
import {
  err,
  type InsertTarget,
  ok,
  parseLocString,
  type ReplaceSvgEdit,
  type Result,
  type StructureEdit,
  type StylingReport,
  type WrapTextEdit,
} from '@kumicraft/shared';

import type { Splice, StructurePlan } from '../../../kernel/text-view-editor.ts';
import type { PugDocument, PugElement } from '../../../lib/pug/markup.ts';

export type PugStructureInput = {
  readonly doc: PugDocument;
  readonly newline: string;
  readonly styling: StylingReport | undefined;
  readonly elements: readonly PugElement[];
  readonly ref?: PugElement | undefined;
  readonly imageSrc: string;
};

const refuse = (code: 'E016' | 'E017' | 'E023', reason: string): Result<StructurePlan> =>
  err({ code, params: { reason } });

/** The indentation unit of the file: its first indented line, two spaces by default. */
export function pugIndentUnit(text: string): string {
  const found = /\n([ \t]+)\S/.exec(text)?.[1];
  if (found === undefined) return '  ';
  return found.startsWith('\t') ? '\t' : found;
}

const indentText = (doc: PugDocument, el: PugElement): string =>
  doc.text.slice(el.lineStart, el.lineStart + el.indent);

/** The element's lines, ending with a newline. */
function blockText(doc: PugDocument, el: PugElement, newline: string): string {
  const text = doc.text.slice(el.lineStart, el.blockEnd);
  return text.endsWith('\n') ? text : text + newline;
}

/** Lines moved to another indentation: `from` at the start of each line becomes `to`. */
function reindent(lines: string, from: string, to: string): string {
  return lines
    .split('\n')
    .map((line) => (line.startsWith(from) ? to + line.slice(from.length) : line))
    .join('\n');
}

/** Where lines go for an insert target, and their indentation. */
function placeFor(
  input: PugStructureInput,
  ref: PugElement,
  target: InsertTarget,
): Result<{ at: number; indent: string; lead: string }> {
  const { doc } = input;
  const own = indentText(doc, ref);
  const unit = pugIndentUnit(doc.text);
  const endsFile = ref.blockEnd >= doc.text.length && !doc.text.endsWith('\n');
  const lead = endsFile ? input.newline : '';
  if (target.kind === 'sibling') {
    if (target.where === 'before') return ok({ at: ref.lineStart, indent: own, lead: '' });
    return ok({ at: ref.blockEnd, indent: own, lead });
  }
  if (ref.selfClosing || ref.inline.kind === 'code') {
    return err({ code: 'E016', params: { reason: 'noChildrenTag' } });
  }
  if (target.where === 'end') return ok({ at: ref.blockEnd, indent: own + unit, lead });
  const afterTag = ref.lineEnd + 1;
  const atEnd = afterTag > doc.text.length;
  return ok({
    at: atEnd ? doc.text.length : afterTag,
    indent: own + unit,
    lead: atEnd ? input.newline : '',
  });
}

function planInsert(
  input: PugStructureInput,
  target: InsertTarget,
  lines: (indent: string) => Result<string[]>,
): Result<StructurePlan> {
  const ref = input.ref;
  if (ref === undefined) return refuse('E017', 'moved');
  if (ref.expanded) return refuse('E023', 'notForPug');
  const place = placeFor(input, ref, target);
  if (!place.ok) return place;
  const made = lines(place.value.indent);
  if (!made.ok) return made;
  const body = made.value.join(input.newline) + input.newline;
  const change: Splice = {
    start: place.value.at,
    end: place.value.at,
    text: place.value.lead + body,
  };
  const within = place.value.lead.length + place.value.indent.length;
  return ok({ changes: [change], made: [{ change: 0, within }] });
}

function blockLines(jsx: string, indent: string, unit: string): Result<string[]> {
  try {
    return ok(renderPugSource(parseBlockJsx(jsx), indent, unit));
  } catch (cause: unknown) {
    if (cause instanceof TreeParseError) return err({ code: 'E016', params: { reason: 'notJsx' } });
    throw cause;
  }
}

/** Only the outermost of the given elements (an inner one goes with its parent). */
function outermost(elements: readonly PugElement[]): PugElement[] {
  return elements.filter(
    (el) =>
      !elements.some((o) => o !== el && o.lineStart < el.lineStart && el.blockEnd <= o.blockEnd),
  );
}

function planRemove(input: PugStructureInput): Result<StructurePlan> {
  if (input.elements.some((el) => el.expanded)) return refuse('E023', 'notForPug');
  const changes = outermost(input.elements).map((el) => ({
    start: el.lineStart,
    end: el.blockEnd,
    text: '',
  }));
  return ok({ changes, made: [] });
}

function planDuplicate(input: PugStructureInput): Result<StructurePlan> {
  if (input.elements.some((el) => el.expanded)) return refuse('E023', 'notForPug');
  const copied = outermost(input.elements);
  const changes = copied.map((el) => ({
    start: el.blockEnd,
    end: el.blockEnd,
    text: blockText(input.doc, el, input.newline),
  }));
  const made = copied.map((el, i) => ({ change: i, within: el.indent }));
  return ok({ changes, made });
}

function planMove(input: PugStructureInput, target: InsertTarget): Result<StructurePlan> {
  const { doc, ref } = input;
  if (ref === undefined) return refuse('E017', 'moved');
  // The `each` / `if` the moved lines land in: the target's (a child of it shares it).
  const landing = ref.codeLine;
  for (const el of input.elements) {
    if (el.expanded) return refuse('E023', 'notForPug');
    if (el.lineStart <= ref.lineStart && ref.blockEnd <= el.blockEnd)
      return refuse('E016', 'moveIntoSelf');
    if (el.codeLine !== landing) return refuse('E023', 'crossesCode');
  }
  const moved = outermost(input.elements);
  const removal = moved.map((el) => ({ start: el.lineStart, end: el.blockEnd, text: '' }));
  const placed = planInsert(input, target, (indent) =>
    ok(
      moved.flatMap((el) =>
        reindent(blockText(doc, el, input.newline), indentText(doc, el), indent)
          .replace(/\r?\n$/, '')
          .split(/\r?\n/),
      ),
    ),
  );
  if (!placed.ok) return placed;
  const offset = removal.length;
  const made = placed.value.made.map((m) => ({ change: m.change + offset, within: m.within }));
  return ok({ changes: [...removal, ...placed.value.changes], made });
}

const WRAP: Record<'tailwind' | 'bootstrap', Record<'row' | 'column' | 'grid', string>> = {
  tailwind: {
    row: '.flex.flex-row.gap-4',
    column: '.flex.flex-col.gap-4',
    grid: '.grid.grid-cols-2.gap-4',
  },
  bootstrap: {
    row: '.d-flex.flex-row.gap-3',
    column: '.d-flex.flex-column.gap-3',
    grid: '.row.row-cols-2.g-3',
  },
};
const WRAP_STYLE: Record<'row' | 'column' | 'grid', string> = {
  row: 'display:flex;flex-direction:row;gap:1rem',
  column: 'display:flex;flex-direction:column;gap:1rem',
  grid: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem',
};

/** The wrapper's tag line in the project's own style system. */
export function pugWrapper(
  styling: StylingReport | undefined,
  kind: 'row' | 'column' | 'grid',
): string {
  const ids = new Set(styling?.systems.map((s) => s.id) ?? []);
  if (ids.has('tailwind')) return WRAP.tailwind[kind];
  if (ids.has('bootstrap')) return WRAP.bootstrap[kind];
  return `div(style=${JSON.stringify(WRAP_STYLE[kind])})`;
}

function planWrap(
  input: PugStructureInput,
  kind: 'row' | 'column' | 'grid',
): Result<StructurePlan> {
  const { doc } = input;
  const sorted = [...input.elements].sort((a, b) => a.lineStart - b.lineStart);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return refuse('E016', 'emptyElements');
  for (const [i, el] of sorted.entries()) {
    const prev = sorted[i - 1];
    if (el.expanded || el.indent !== first.indent || el.codeLine !== first.codeLine) {
      return refuse('E016', 'notSameParent');
    }
    if (prev !== undefined && doc.text.slice(prev.blockEnd, el.lineStart).trim() !== '') {
      return refuse('E016', 'notContiguous');
    }
  }
  const own = indentText(doc, first);
  const unit = pugIndentUnit(doc.text);
  const body = reindent(doc.text.slice(first.lineStart, last.blockEnd), own, own + unit);
  const tail = body.endsWith('\n') ? '' : input.newline;
  const text = `${own}${pugWrapper(input.styling, kind)}${input.newline}${body}${tail}`;
  return ok({
    changes: [{ start: first.lineStart, end: last.blockEnd, text }],
    made: [{ change: 0, within: own.length }],
  });
}

function planUnwrap(input: PugStructureInput): Result<StructurePlan> {
  const { doc } = input;
  const el = input.elements[0];
  if (el === undefined || el.expanded) return refuse('E023', 'notForPug');
  if (el.inline.kind !== 'none' || el.childLines.length === 0)
    return refuse('E016', 'nothingToUnwrap');
  const first = el.childLines.find((n) => doc.lines[n - 1]?.blank !== true) ?? el.line;
  const childStart = doc.lineStarts[first - 1] ?? el.blockEnd;
  const childIndent = doc.text.slice(childStart, childStart + (doc.lines[first - 1]?.indent ?? 0));
  const body = reindent(doc.text.slice(childStart, el.blockEnd), childIndent, indentText(doc, el));
  return ok({ changes: [{ start: el.lineStart, end: el.blockEnd, text: body }], made: [] });
}

function imageLine(src: string, alt: string, className: string): string {
  const classes = className.split(/\s+/).filter((c) => c !== '');
  const dots = classes.every((c) => /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(c))
    ? classes.map((c) => `.${c}`).join('')
    : '';
  const cls =
    dots === '' && classes.length > 0 ? `, class=${JSON.stringify(classes.join(' '))}` : '';
  return `img${dots}(src=${JSON.stringify(src)}, alt=${JSON.stringify(alt)}${cls})`;
}

function insertIncludeLine(
  target: InsertTarget,
  jsx: string,
  fromFile: string | undefined,
  indent: string,
): Result<string[]> | undefined {
  if (fromFile !== undefined && fromFile.endsWith('.pug')) {
    const targetLoc = target.kind === 'sibling' ? target.ref.loc : target.parent.loc;
    const targetFile = parseLocString(targetLoc)?.file;
    if (targetFile !== undefined) {
      const rel = posix.relative(posix.dirname(targetFile), fromFile).replace(/\.pug$/i, '');
      const spec = rel.startsWith('.') ? rel : `./${rel}`;
      return ok([`${indent}include ${spec}`]);
    }
  }
  if (/^\s*include\s+\S+/.test(jsx)) {
    return ok([`${indent}${jsx.trim()}`]);
  }
  return undefined;
}

function planWrapText(input: PugStructureInput, edit: WrapTextEdit): Result<StructurePlan> {
  const el = input.elements[0];
  if (el === undefined) return refuse('E017', 'moved');
  if (el.expanded || el.inline.kind !== 'text') return refuse('E023', 'notForPug');
  const raw = el.inline.value;
  const leadSpaces = raw.length - raw.trimStart().length;
  const text = raw.slice(leadSpaces);
  if (edit.start < 0 || edit.end > text.length || edit.start >= edit.end) {
    return err({ code: 'E016', params: { reason: 'invalidRange' } });
  }
  const classes = (edit.wrapper.className ?? '').split(/\s+/).filter((c) => c !== '');
  const dots = classes.every((c) => /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(c))
    ? classes.map((c) => `.${c}`).join('')
    : '';
  const attr =
    dots === '' && classes.length > 0 ? `(class=${JSON.stringify(classes.join(' '))})` : '';
  const wrapped = `#[${edit.wrapper.tag}${dots}${attr} ${text.slice(edit.start, edit.end)}]`;
  const nextInline = `${raw.slice(0, leadSpaces)}${text.slice(0, edit.start)}${wrapped}${text.slice(edit.end)}`;
  return ok({
    changes: [{ start: el.inline.start, end: el.inline.end, text: nextInline }],
    made: [],
  });
}

function planReplaceSvg(
  input: PugStructureInput,
  edit: ReplaceSvgEdit,
  unit: string,
): Result<StructurePlan> {
  const el = input.elements[0];
  if (el === undefined) return refuse('E017', 'moved');
  if (el.expanded || el.tag.toLowerCase() !== 'svg') return refuse('E023', 'notForPug');
  const childIndent = `${indentText(input.doc, el)}${unit}`;
  const lines = edit.icon.node.map(([tag, attrs]) => {
    const entries = Object.entries(attrs).map(([k, v]) => `${k}=${JSON.stringify(String(v))}`);
    return `${childIndent}${tag}${entries.length > 0 ? `(${entries.join(', ')})` : ''}`;
  });
  const body = lines.join(input.newline) + input.newline;
  const childStart = Math.min(el.lineEnd + 1, input.doc.text.length);
  const lead = el.lineEnd + 1 > input.doc.text.length ? input.newline : '';
  return ok({
    changes: [{ start: childStart, end: el.blockEnd, text: `${lead}${body}` }],
    made: [],
  });
}

/** The text changes of a structure edit on one .pug file. */
export function planPugStructure(
  input: PugStructureInput,
  edit: StructureEdit,
): Result<StructurePlan> {
  const unit = pugIndentUnit(input.doc.text);
  switch (edit.kind) {
    case 'insert':
      return planInsert(input, edit.target, (indent) => {
        const inc = insertIncludeLine(edit.target, edit.jsx, edit.from?.file, indent);
        return inc ?? blockLines(edit.jsx, indent, unit);
      });
    case 'insertImage':
      return planInsert(input, edit.target, (indent) =>
        ok([`${indent}${imageLine(input.imageSrc, edit.alt, edit.className)}`]),
      );
    case 'remove':
      return planRemove(input);
    case 'duplicate':
      return planDuplicate(input);
    case 'move':
      return planMove(input, edit.target);
    case 'wrap':
      return planWrap(input, edit.wrapper);
    case 'unwrap':
      return planUnwrap(input);
    case 'wrapText':
      return planWrapText(input, edit);
    case 'replaceSvg':
      return planReplaceSvg(input, edit, unit);
    case 'setDataArray':
      return refuse('E023', 'notForPug');
  }
}
