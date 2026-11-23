// The HTML of a .cshtml file (docs/architecture/03c section 2.3). The Razor helper says which parts
// are C# (`code`); this reads the elements of the rest, with the exact place of every tag,
// attribute and text, so an edit replaces only HTML characters and never touches C#.

export type Span = { readonly start: number; readonly end: number };

/** One piece of an attribute value: written text, or C# (`@x`, `@(…)`). */
export type ValuePart = Span & { readonly kind: 'static' | 'code' };

export type RazorAttr = Span & {
  readonly name: string;
  /** The value between the quotes (or the bare value); absent: `disabled`. */
  readonly value?: (Span & { readonly parts: readonly ValuePart[] }) | undefined;
};

export type RazorElement = {
  readonly kind: 'element';
  readonly tag: string;
  /** `<` of the start tag. */
  readonly start: number;
  /** Just after the tag name, where the location stamp goes. */
  readonly nameEnd: number;
  /** Just after the `>` of the start tag. */
  readonly openEnd: number;
  readonly selfClosing: boolean;
  readonly attrs: readonly RazorAttr[];
  readonly children: RazorNode[];
  /** The end tag; absent: void, self-closing or never closed. */
  close?: Span | undefined;
  /** C# block the element is in (index into `blocks`); -1: none. */
  readonly block: number;
};

export type RazorNode =
  | RazorElement
  | (Span & { readonly kind: 'text' })
  | (Span & { readonly kind: 'code' })
  | (Span & { readonly kind: 'comment' });

/** A C# block opened by `{` in code: `@foreach (…) {`, `@if (…) {`, `@{`. */
export type CodeBlock = { readonly parent: number; readonly loop: boolean };

export type RazorDocument = {
  readonly text: string;
  readonly roots: readonly RazorNode[];
  readonly elements: readonly RazorElement[];
  readonly blocks: readonly CodeBlock[];
};

export const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const LOOP_WORDS = /\b(foreach|for|while|do)\b/;

/** Finds the C# range that holds `at`, among sorted ranges. */
function codeAt(code: readonly Span[], at: number): Span | undefined {
  let lo = 0;
  let hi = code.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = code[mid];
    if (range === undefined) return undefined;
    if (at < range.start) hi = mid - 1;
    else if (at >= range.end) lo = mid + 1;
    else return range;
  }
  return undefined;
}

/** Braces of a C# piece, outside strings and comments: what blocks it opens and closes. */
function braceSteps(code: string): ('{' | '}')[] {
  const steps: ('{' | '}')[] = [];
  let quote = '';
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    if (quote !== '') {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      i = nl < 0 ? code.length : nl;
    } else if (ch === '{' || ch === '}') steps.push(ch);
  }
  return steps;
}

class Reader {
  readonly text: string;
  readonly code: readonly Span[];
  readonly elements: RazorElement[] = [];
  readonly blocks: CodeBlock[] = [];
  readonly roots: RazorNode[] = [];
  private readonly open: RazorElement[] = [];
  private blockStack: number[] = [];
  private textStart = -1;
  at = 0;

  constructor(text: string, code: readonly Span[]) {
    this.text = text;
    this.code = code;
  }

  private add(node: RazorNode): void {
    const parent = this.open.at(-1);
    if (parent === undefined) this.roots.push(node);
    else parent.children.push(node);
  }

  flushText(end: number): void {
    if (this.textStart >= 0 && end > this.textStart) {
      this.add({ kind: 'text', start: this.textStart, end });
    }
    this.textStart = -1;
  }

  /** A C# piece between elements: kept as one node, and its braces open or close blocks. */
  takeCode(range: Span): void {
    this.flushText(range.start);
    this.add({ kind: 'code', start: range.start, end: range.end });
    const piece = this.text.slice(range.start, range.end);
    for (const step of braceSteps(piece)) {
      if (step === '{') {
        const parent = this.blockStack.at(-1) ?? -1;
        this.blocks.push({ parent, loop: LOOP_WORDS.test(piece) });
        this.blockStack.push(this.blocks.length - 1);
      } else this.blockStack.pop();
    }
    this.at = range.end;
  }

  markText(): void {
    if (this.textStart < 0) this.textStart = this.at;
    this.at += 1;
  }

  /** `<!-- … -->`, read as one node. */
  takeComment(): void {
    this.flushText(this.at);
    const end = this.text.indexOf('-->', this.at + 4);
    const stop = end < 0 ? this.text.length : end + 3;
    this.add({ kind: 'comment', start: this.at, end: stop });
    this.at = stop;
  }

  /** `</tag>`: closes the nearest open element of that name; a stray one is left as text. */
  takeEndTag(name: string): void {
    const gt = this.text.indexOf('>', this.at);
    const stop = gt < 0 ? this.text.length : gt + 1;
    const index = this.open.findLastIndex((e) => e.tag === name);
    if (index < 0) {
      this.markText();
      return;
    }
    this.flushText(this.at);
    const element = this.open[index];
    if (element !== undefined) element.close = { start: this.at, end: stop };
    this.open.length = index;
    this.at = stop;
  }

  openElement(element: RazorElement): void {
    this.flushText(element.start);
    this.add(element);
    this.elements.push(element);
    this.at = element.openEnd;
    if (element.selfClosing || VOID_TAGS.has(element.tag)) return;
    if (RAW_TEXT_TAGS.has(element.tag)) {
      this.skipRawText(element);
      return;
    }
    this.open.push(element);
  }

  /** `<script>` and the like: their content is not HTML; only the end tag matters. */
  private skipRawText(element: RazorElement): void {
    const end = this.text.toLowerCase().indexOf(`</${element.tag}`, this.at);
    if (end < 0) {
      this.at = this.text.length;
      return;
    }
    if (end > this.at) element.children.push({ kind: 'text', start: this.at, end });
    const gt = this.text.indexOf('>', end);
    const stop = gt < 0 ? this.text.length : gt + 1;
    element.close = { start: end, end: stop };
    this.at = stop;
  }

  currentBlock(): number {
    return this.blockStack.at(-1) ?? -1;
  }
}

const NAME = /[A-Za-z][\w:.-]*/y;
const ATTR_NAME = /[^\s"'<>/=]+/y;

function readName(reader: Reader, from: number): string | undefined {
  NAME.lastIndex = from;
  return NAME.exec(reader.text)?.[0];
}

function skipSpaces(reader: Reader): void {
  while (/\s/.test(reader.text[reader.at] ?? '')) reader.at += 1;
}

/** The parts of an attribute value from `start` to `end`: written text and C# ranges. */
function valueParts(reader: Reader, start: number, end: number): ValuePart[] {
  const parts: ValuePart[] = [];
  let at = start;
  while (at < end) {
    const range = codeAt(reader.code, at);
    if (range !== undefined) {
      parts.push({ kind: 'code', start: at, end: Math.min(range.end, end) });
      at = Math.min(range.end, end);
      continue;
    }
    let stop = at;
    while (stop < end && codeAt(reader.code, stop) === undefined) stop += 1;
    parts.push({ kind: 'static', start: at, end: stop });
    at = stop;
  }
  return parts;
}

function readValue(reader: Reader): RazorAttr['value'] {
  const quote = reader.text[reader.at];
  if (quote === '"' || quote === "'") {
    const start = reader.at + 1;
    let end = start;
    // A quote inside C# (`@(x ? "a" : "b")`) does not end the value.
    while (end < reader.text.length && reader.text[end] !== quote) {
      end = codeAt(reader.code, end)?.end ?? end + 1;
    }
    reader.at = Math.min(end + 1, reader.text.length);
    return { start, end, parts: valueParts(reader, start, end) };
  }
  const start = reader.at;
  while (reader.at < reader.text.length && !/[\s>]/.test(reader.text[reader.at] ?? '')) {
    reader.at = codeAt(reader.code, reader.at)?.end ?? reader.at + 1;
  }
  return { start, end: reader.at, parts: valueParts(reader, start, reader.at) };
}

function readAttr(reader: Reader): RazorAttr | undefined {
  const start = reader.at;
  const range = codeAt(reader.code, start);
  if (range !== undefined) {
    // C# in place of an attribute (`@Html.Raw(…)`, `@if`): skipped, never edited.
    reader.at = range.end;
    return undefined;
  }
  ATTR_NAME.lastIndex = start;
  const name = ATTR_NAME.exec(reader.text)?.[0];
  if (name === undefined) {
    reader.at += 1;
    return undefined;
  }
  reader.at = start + name.length;
  skipSpaces(reader);
  if (reader.text[reader.at] !== '=') return { name, start, end: start + name.length };
  reader.at += 1;
  skipSpaces(reader);
  const value = readValue(reader);
  return { name, start, end: reader.at, value };
}

function readStartTag(reader: Reader, tag: string): RazorElement {
  const start = reader.at;
  const nameEnd = start + 1 + tag.length;
  reader.at = nameEnd;
  const attrs: RazorAttr[] = [];
  let selfClosing = false;
  while (reader.at < reader.text.length) {
    skipSpaces(reader);
    const ch = reader.text[reader.at];
    if (ch === '>') break;
    if (ch === '/' && reader.text[reader.at + 1] === '>') {
      selfClosing = true;
      reader.at += 1;
      break;
    }
    const attr = readAttr(reader);
    if (attr !== undefined) attrs.push(attr);
  }
  const openEnd = Math.min(reader.at + 1, reader.text.length);
  const lower = tag.toLowerCase();
  const block = reader.currentBlock();
  return {
    kind: 'element',
    tag: lower,
    start,
    nameEnd,
    openEnd,
    selfClosing,
    attrs,
    children: [],
    block,
  };
}

function step(reader: Reader): void {
  const range = codeAt(reader.code, reader.at);
  if (range !== undefined) {
    reader.takeCode(range);
    return;
  }
  const text = reader.text;
  if (text[reader.at] !== '<') {
    reader.markText();
    return;
  }
  if (text.startsWith('<!--', reader.at)) {
    reader.takeComment();
    return;
  }
  const isEnd = text[reader.at + 1] === '/';
  const name = readName(reader, reader.at + (isEnd ? 2 : 1));
  if (name === undefined) reader.markText();
  else if (isEnd) reader.takeEndTag(name.toLowerCase());
  else reader.openElement(readStartTag(reader, name));
}

/** Reads the HTML of `text`, given the C# ranges the Razor helper found (sorted). */
export function readRazorMarkup(text: string, code: readonly Span[]): RazorDocument {
  const reader = new Reader(text, code);
  while (reader.at < text.length) step(reader);
  reader.flushText(text.length);
  return { text, roots: reader.roots, elements: reader.elements, blocks: reader.blocks };
}

/** Whether the element sits inside a loop (`@foreach`): one edit changes every repetition. */
export function inLoop(doc: RazorDocument, element: RazorElement): boolean {
  let block = element.block;
  while (block >= 0) {
    const current = doc.blocks[block];
    if (current === undefined) return false;
    if (current.loop) return true;
    block = current.parent;
  }
  return false;
}

/** 1-based line and column of an offset, as `data-rc-loc` writes them. */
export function lineCol(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = text.indexOf('\n'); i >= 0 && i < offset; i = text.indexOf('\n', i + 1)) {
    line += 1;
    lineStart = i + 1;
  }
  return { line, col: offset - lineStart + 1 };
}
