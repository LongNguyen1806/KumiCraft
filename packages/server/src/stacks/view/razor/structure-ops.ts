// The structure edits of the Razor editor, each computed as text changes of one .cshtml (plus, for
// an image or a block's CSS, the files that go with it). Writing and Undo are the kernel's.
import {
  err,
  type InsertTarget,
  ok,
  type Result,
  type StructureEdit,
  type StylingReport,
} from '@kumicraft/shared';

import type { RazorDocument, RazorElement } from '../../../lib/razor/markup.ts';
import type { Change } from './element-edits.ts';
import { writeText } from './element-edits.ts';
import {
  blockMarkup,
  elementEnd,
  indentAt,
  indentUnit,
  insertNear,
  parentOf,
  sameBlock,
  type Where,
  wholeLines,
  wrapperTag,
} from './structure-edits.ts';

/** The elements an edit names, already found in the one file it edits. */
export type StructureInput = {
  readonly doc: RazorDocument;
  readonly newline: string;
  readonly styling: StylingReport | undefined;
  /** Element of each guard of the edit, in the edit's order. */
  readonly elements: readonly RazorElement[];
  /** The element the target names (insert, move). */
  readonly ref?: RazorElement | undefined;
  /** `src` of an inserted image (an uploaded one is already saved by the editor). */
  readonly imageSrc?: string | undefined;
};

export type StructurePlan = {
  readonly changes: Change[];
  /** Each element the edit made (selected afterwards): which change holds it, and where in it. */
  readonly made: { readonly change: number; readonly within: number }[];
};

const refuse = (code: 'E016' | 'E017' | 'E023', reason: string): Result<StructurePlan> =>
  err({ code, params: { reason } });

const whereOf = (target: InsertTarget): Where =>
  target.kind === 'sibling' ? target.where : target.where;

/** Puts the inserted text at its place and says where its first element ends up. */
function planInsert(
  input: StructureInput,
  target: InsertTarget,
  markup: (indent: string) => string,
): Result<StructurePlan> {
  const { doc, ref } = input;
  if (ref === undefined) return refuse('E017', 'moved');
  const unit = indentUnit(doc.text);
  const change = insertNear(doc, ref, whereOf(target), markup, unit, input.newline);
  if (!change.ok) return change;
  const lead = change.value.text.length - change.value.text.trimStart().length;
  return ok({ changes: [change.value], made: [{ change: 0, within: lead }] });
}

function planRemove(input: StructureInput): Result<StructurePlan> {
  const outer = input.elements.filter(
    (el) =>
      !input.elements.some(
        (o) => o !== el && o.start < el.start && elementEnd(el) <= elementEnd(o),
      ),
  );
  return ok({
    changes: outer.map((el) => ({ ...wholeLines(input.doc.text, el), text: '' })),
    made: [],
  });
}

function planDuplicate(input: StructureInput): Result<StructurePlan> {
  const text = input.doc.text;
  const changes = input.elements.map((el) => {
    const at = elementEnd(el);
    return {
      start: at,
      end: at,
      text: `${input.newline}${indentAt(text, el.start)}${text.slice(el.start, at)}`,
    };
  });
  return ok({
    changes,
    made: changes.map((c, i) => ({ change: i, within: c.text.length - c.text.trimStart().length })),
  });
}

/** Re-indents the lines after the first of an element's markup for a new place. */
function reindent(markup: string, from: string, to: string): string {
  return markup
    .split('\n')
    .map((line, i) => (i === 0 || !line.startsWith(from) ? line : to + line.slice(from.length)))
    .join('\n');
}

function planMove(input: StructureInput, target: InsertTarget): Result<StructurePlan> {
  const { doc, ref } = input;
  if (ref === undefined) return refuse('E017', 'moved');
  const text = doc.text;
  // The C# block the moved elements land in: the target's own, or the one inside the parent.
  const firstChild = ref.children.find((c): c is RazorElement => c.kind === 'element');
  const landing = target.kind === 'sibling' ? ref.block : (firstChild?.block ?? ref.block);
  for (const el of input.elements) {
    if (el.start <= ref.start && elementEnd(ref) <= elementEnd(el))
      return refuse('E016', 'moveIntoSelf');
    if (el.block !== landing) return refuse('E023', 'crossesCode');
  }
  const pieces = input.elements.map((el) => ({ el, body: text.slice(el.start, elementEnd(el)) }));
  const removal = planRemove(input);
  if (!removal.ok) return removal;
  const placed = planInsert(input, target, (indent) =>
    pieces
      .map((p) => reindent(p.body, indentAt(text, p.el.start), indent))
      .join(input.newline + indent),
  );
  if (!placed.ok) return placed;
  const moved = removal.value.changes.length;
  const made = placed.value.made.map((m) => ({ change: m.change + moved, within: m.within }));
  return ok({ changes: [...removal.value.changes, ...placed.value.changes], made });
}

function planWrap(
  input: StructureInput,
  wrapper: 'row' | 'column' | 'grid',
): Result<StructurePlan> {
  const { doc } = input;
  const sorted = [...input.elements].sort((a, b) => a.start - b.start);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return refuse('E016', 'emptyElements');
  const parent = parentOf(doc, first);
  if (sorted.some((el) => parentOf(doc, el) !== parent || !sameBlock(el, first))) {
    return refuse('E016', 'notSameParent');
  }
  const text = doc.text;
  const indent = indentAt(text, first.start);
  const unit = indentUnit(text);
  const body = reindent(text.slice(first.start, elementEnd(last)), indent, indent + unit);
  const nl = input.newline;
  const wrapped = `${wrapperTag(input.styling, wrapper)}${nl}${indent}${unit}${body}${nl}${indent}</div>`;
  return ok({
    changes: [{ start: first.start, end: elementEnd(last), text: wrapped }],
    made: [{ change: 0, within: 0 }],
  });
}

function planUnwrap(input: StructureInput): Result<StructurePlan> {
  const el = input.elements[0];
  const close = el?.close;
  if (el === undefined || close === undefined) return refuse('E016', 'nothingToUnwrap');
  const text = input.doc.text;
  const inner = text.slice(el.openEnd, close.start);
  if (inner.trim() === '') return refuse('E016', 'nothingToUnwrap');
  const indent = indentAt(text, el.start);
  const unit = indentUnit(text);
  const body = reindent(inner.trim(), indent + unit, indent);
  return ok({ changes: [{ start: el.start, end: close.end, text: body }], made: [] });
}

function imageMarkup(src: string, alt: string, className: string): string {
  const cls = className.trim() === '' ? '' : ` class="${writeText(className.trim(), true)}"`;
  return `<img src="${writeText(src, true)}" alt="${writeText(alt, true)}"${cls} />`;
}

/** The text changes of a structure edit on one file. */
export function planRazorStructure(
  input: StructureInput,
  edit: StructureEdit,
): Result<StructurePlan> {
  switch (edit.kind) {
    case 'insert': {
      const unit = indentUnit(input.doc.text);
      const check = blockMarkup(edit.jsx, '', unit, input.newline);
      if (!check.ok) return check;
      return planInsert(input, edit.target, (indent) => {
        const markup = blockMarkup(edit.jsx, indent, unit, input.newline);
        return markup.ok ? markup.value : check.value;
      });
    }
    case 'insertImage':
      return planInsert(input, edit.target, () =>
        imageMarkup(input.imageSrc ?? '', edit.alt, edit.className),
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
    case 'replaceSvg':
    case 'setDataArray':
      return refuse('E023', 'notForRazor');
  }
}
