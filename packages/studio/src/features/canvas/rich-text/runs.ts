// TextRun[] ⇄ TipTap document (ADR-FE-20, SPEC-03 TextRun, V-34, V-35). Pure functions: the
// editor opens on runsToDoc(runs) and the Design Model takes docToRuns(editor.getJSON()).
import { type Color, LINK_HREF_PATTERN, type TextRun } from '@reactcraft/model';
import type { JSONContent } from '@tiptap/core';

type Mark = { readonly type: string; readonly attrs?: Readonly<Record<string, unknown>> };

function marksOf(run: TextRun): Mark[] {
  const marks: Mark[] = [];
  if (run.bold === true) marks.push({ type: 'bold' });
  if (run.italic === true) marks.push({ type: 'italic' });
  if (run.underline === true) marks.push({ type: 'underline' });
  if (run.strike === true) marks.push({ type: 'strike' });
  if (run.code === true) marks.push({ type: 'code' });
  if (run.link !== undefined) {
    marks.push({
      type: 'link',
      attrs: { href: run.link.href, target: run.link.newTab === true ? '_blank' : '' },
    });
  }
  if (run.color !== undefined) marks.push({ type: 'textStyle', attrs: { color: run.color } });
  return marks;
}

/** One paragraph; `\n` becomes a hard break that keeps the format of its run. */
export function runsToDoc(runs: readonly TextRun[]): JSONContent {
  const content: JSONContent[] = [];
  for (const run of runs) {
    const marks = marksOf(run);
    const withMarks = marks.length === 0 ? {} : { marks: [...marks] };
    run.text.split('\n').forEach((part, i) => {
      if (i > 0) content.push({ type: 'hardBreak', ...withMarks });
      if (part !== '') content.push({ type: 'text', text: part, ...withMarks });
    });
  }
  return {
    type: 'doc',
    content: [{ type: 'paragraph', ...(content.length === 0 ? {} : { content }) }],
  };
}

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
const TOKEN = /^token:color\.[a-z0-9]+(-[a-z0-9]+)*$/;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/;

/** A colour the Design Model accepts (V-02), or undefined: pasted colours come as rgb() or names. */
export function toModelColor(value: unknown): Color | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.trim().toLowerCase();
  if (HEX.test(lower) || TOKEN.test(lower)) return lower as Color;
  const rgb = RGB.exec(lower) ?? undefined;
  if (rgb === undefined) return undefined;
  const hex = rgb
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'));
  return `#${hex.join('')}`;
}

function formatOf(marks: readonly Mark[] | undefined): Omit<TextRun, 'text'> {
  const format: { -readonly [K in keyof TextRun]?: TextRun[K] } = {};
  for (const mark of marks ?? []) {
    if (
      mark.type === 'bold' ||
      mark.type === 'italic' ||
      mark.type === 'underline' ||
      mark.type === 'strike' ||
      mark.type === 'code'
    ) {
      format[mark.type] = true;
    } else if (
      mark.type === 'link' &&
      typeof mark.attrs?.['href'] === 'string' &&
      LINK_HREF_PATTERN.test(mark.attrs['href'])
    ) {
      format.link = {
        href: mark.attrs['href'],
        ...(mark.attrs['target'] === '_blank' ? { newTab: true } : {}),
      };
    } else if (mark.type === 'textStyle') {
      const color = toModelColor(mark.attrs?.['color']);
      if (color !== undefined) format.color = color;
    }
  }
  return format;
}

const sameFormat = (a: Omit<TextRun, 'text'>, b: Omit<TextRun, 'text'>) => {
  const key = (f: Omit<TextRun, 'text'>) =>
    JSON.stringify([
      f.bold,
      f.italic,
      f.underline,
      f.strike,
      f.code,
      f.link?.href,
      f.link?.newTab,
      f.color,
    ]);
  return key(a) === key(b);
};

/**
 * Runs of a document, merged so that neighbours always differ (V-34). Paragraphs join with `\n`;
 * formats the model does not hold (and unsafe links) are dropped.
 */
export function docToRuns(doc: JSONContent): TextRun[] {
  const runs: TextRun[] = [];
  const push = (text: string, marks: readonly Mark[] | undefined) => {
    if (text === '') return;
    const format = formatOf(marks);
    const last = runs.at(-1);
    if (last !== undefined && sameFormat(last, format))
      runs[runs.length - 1] = { ...last, text: last.text + text };
    else runs.push({ text, ...format });
  };
  (doc.content ?? []).forEach((block, i) => {
    if (i > 0) push('\n', runs.at(-1) === undefined ? undefined : marksOf(runs.at(-1) as TextRun));
    for (const inline of block.content ?? []) {
      if (inline.type === 'text') push(inline.text ?? '', inline.marks);
      else if (inline.type === 'hardBreak') push('\n', inline.marks);
    }
  });
  return runs;
}
