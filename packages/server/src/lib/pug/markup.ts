// The elements of a .pug file (docs/architecture/03d section 2.1), read with Pug's own lexer
// (`pug-lexer`): every tag line with the exact place of its tag name, shorthand classes and ids,
// attributes and inline text, and its block (the lines indented under it). An edit then replaces
// only those characters, or whole lines for structure edits.
import { createRequire } from 'node:module';

export type Span = { readonly start: number; readonly end: number };

/** A token of the selector (`div`, `.card`, `#main`), with its place. */
export type PugPart = Span & { readonly kind: 'tag' | 'class' | 'id'; readonly name: string };

export type PugAttr = Span & {
  readonly name: string;
  /** The value as written (`"/x"`, `'a'`, `user.url`); `true`: a bare attribute (`disabled`). */
  readonly val: string | true;
};

/** What follows the tag on its line: written text, `= code`, or text with `#{…}`. */
export type PugInline =
  | { readonly kind: 'none' }
  | (Span & { readonly kind: 'text'; readonly value: string })
  | (Span & { readonly kind: 'code' | 'mixed' });

export type PugElement = {
  readonly tag: string;
  /** False for an implicit `div` (`.card`). */
  readonly explicitTag: boolean;
  readonly line: number;
  readonly col: number;
  readonly start: number;
  readonly parts: readonly PugPart[];
  readonly attrs: readonly PugAttr[];
  /** `(` … `)` of the attributes, if any (the first group). */
  readonly attrsSpan?: Span | undefined;
  /** End of the selector and attributes: where inline content starts. */
  readonly headEnd: number;
  readonly inline: PugInline;
  readonly selfClosing: boolean;
  /** Indentation of the tag line (characters), and its block of lines. */
  readonly indent: number;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly blockEnd: number;
  /** Inside `tag: child` on the same line: the child of a block expansion. */
  readonly expanded: boolean;
  /** The `each` / `if`… line the element is inside (-1: none), and whether a loop is around it. */
  readonly codeLine: number;
  readonly loop: boolean;
  /** Line numbers of the lines inside the block (children, text, code). */
  readonly childLines: readonly number[];
};

export type PugDocument = {
  readonly text: string;
  readonly elements: readonly PugElement[];
  /** Each line (index 0 is line 1): its indentation, whether it is blank, its first token type. */
  readonly lines: readonly LineInfo[];
  /** Offset of the start of each line (index 0 is line 1). */
  readonly lineStarts: readonly number[];
};

type Token = {
  readonly type: string;
  readonly val?: string | number | boolean;
  readonly name?: string;
  readonly loc: {
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
  };
};

const lexer: unknown = createRequire(import.meta.url)('pug-lexer');

function lex(text: string, filename: string): Token[] {
  if (typeof lexer !== 'function') throw new Error('pug-lexer did not load');
  const out: unknown = Reflect.apply(lexer, undefined, [text, { filename }]);
  return Array.isArray(out) ? (out as Token[]) : [];
}

const CONTENT = new Set(['text', 'interpolated-code', 'code', 'start-pug-interpolation']);
/** Lines that make a C# like block around their children: an element cannot move across them. */
const CODE_KINDS = new Set([
  'each',
  'eachOf',
  'while',
  'if',
  'else-if',
  'else',
  'unless',
  'case',
  'when',
  'default',
]);
const LOOP_KINDS = new Set(['each', 'eachOf', 'while']);
const SELF_CLOSING_TAGS = new Set([
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

function lineStartsOf(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

const indentOf = (line: string): number => line.length - line.trimStart().length;

export type LineInfo = { readonly indent: number; readonly blank: boolean; readonly kind: string };

/** What each line starts with (its first token), and its indentation. */
function lineInfos(text: string, starts: readonly number[], tokens: readonly Token[]): LineInfo[] {
  const first = new Map<number, string>();
  for (const t of tokens) {
    if (t.type === 'indent' || t.type === 'outdent' || t.type === 'newline' || t.type === 'eos')
      continue;
    if (!first.has(t.loc.start.line)) first.set(t.loc.start.line, t.type);
  }
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? text.length;
    const line = text.slice(start, end).replace(/\r?\n$/, '');
    return { indent: indentOf(line), blank: line.trim() === '', kind: first.get(i + 1) ?? '' };
  });
}

/** The lines of the block under `line`: until the next line indented as much or less. */
function blockLines(lines: readonly LineInfo[], line: number): number[] {
  const own = lines[line - 1]?.indent ?? 0;
  const out: number[] = [];
  for (let i = line; i < lines.length; i += 1) {
    const info = lines[i];
    if (info === undefined) break;
    if (!info.blank && info.indent <= own) break;
    out.push(i + 1);
  }
  while (out.length > 0 && lines[(out.at(-1) ?? 1) - 1]?.blank === true) out.pop();
  return out;
}

/** The code line around `line` (`each`, `if`…) and whether a loop is around it. */
function codeContext(
  lines: readonly LineInfo[],
  line: number,
): { codeLine: number; loop: boolean } {
  let indent = lines[line - 1]?.indent ?? 0;
  let codeLine = -1;
  let loop = false;
  for (let i = line - 2; i >= 0 && indent > 0; i -= 1) {
    const info = lines[i];
    if (info === undefined || info.blank || info.indent >= indent) continue;
    indent = info.indent;
    if (CODE_KINDS.has(info.kind) && codeLine < 0) codeLine = i + 1;
    if (LOOP_KINDS.has(info.kind)) loop = true;
  }
  return { codeLine, loop };
}

type Ctx = {
  readonly text: string;
  readonly starts: readonly number[];
  readonly lines: readonly LineInfo[];
};

const offset = (ctx: Ctx, at: { line: number; column: number }): number =>
  (ctx.starts[at.line - 1] ?? 0) + at.column - 1;

const spanOf = (ctx: Ctx, t: Token): Span => ({
  start: offset(ctx, t.loc.start),
  end: offset(ctx, t.loc.end),
});

function inlineOf(ctx: Ctx, tokens: readonly Token[]): PugInline {
  const content = tokens.filter((t) => CONTENT.has(t.type) || t.type === 'end-pug-interpolation');
  const first = content[0];
  const last = content.at(-1);
  if (first === undefined || last === undefined) return { kind: 'none' };
  const span = { start: spanOf(ctx, first).start, end: spanOf(ctx, last).end };
  if (content.some((t) => t.type === 'code')) return { kind: 'code', ...span };
  if (content.some((t) => t.type !== 'text')) return { kind: 'mixed', ...span };
  const value = content.map((t) => String(t.val ?? '')).join('');
  return { kind: 'text', value, ...span };
}

type Head = { parts: PugPart[]; attrs: PugAttr[]; attrsSpan?: Span; end: number; next: number };

/** The selector and attributes from token `i` on, until content or `:`. */
function readHead(ctx: Ctx, tokens: readonly Token[], i: number): Head {
  const parts: PugPart[] = [];
  const attrs: PugAttr[] = [];
  let attrsSpan: Span | undefined;
  const first = tokens[i];
  let end = first === undefined ? 0 : spanOf(ctx, first).start;
  let at = i;
  for (; at < tokens.length; at += 1) {
    const t = tokens[at];
    if (t === undefined) break;
    if (t.type === 'tag' || t.type === 'class' || t.type === 'id') {
      parts.push({ kind: t.type, name: String(t.val ?? ''), ...spanOf(ctx, t) });
    } else if (t.type === 'start-attributes') {
      attrsSpan ??= { start: spanOf(ctx, t).start, end: spanOf(ctx, t).end };
    } else if (t.type === 'attribute') {
      const val = t.val === true ? true : String(t.val ?? '');
      attrs.push({ name: t.name ?? '', val, ...spanOf(ctx, t) });
    } else if (t.type === 'end-attributes') {
      if (attrsSpan !== undefined && attrsSpan.end <= spanOf(ctx, t).start) {
        attrsSpan = { start: attrsSpan.start, end: spanOf(ctx, t).end };
      }
    } else if (t.type !== '&attributes' && t.type !== 'slash') break;
    end = spanOf(ctx, t).end;
  }
  return { parts, attrs, ...(attrsSpan === undefined ? {} : { attrsSpan }), end, next: at };
}

function makeElement(ctx: Ctx, tokens: readonly Token[], i: number, expanded: boolean) {
  const first = tokens[i];
  if (first === undefined) return undefined;
  const head = readHead(ctx, tokens, i);
  const rest = tokens.slice(head.next);
  const colon = rest.findIndex((t) => t.type === ':');
  const own = colon < 0 ? rest : rest.slice(0, colon);
  const line = first.loc.start.line;
  const info = ctx.lines[line - 1];
  const tagPart = head.parts.find((p) => p.kind === 'tag');
  const tag = (tagPart?.name ?? 'div').toLowerCase();
  const block = expanded ? [] : blockLines(ctx.lines, line);
  const lastLine = block.at(-1) ?? line;
  const element: PugElement = {
    tag,
    explicitTag: tagPart !== undefined,
    line,
    col: first.loc.start.column,
    start: spanOf(ctx, first).start,
    parts: head.parts,
    attrs: head.attrs,
    attrsSpan: head.attrsSpan,
    headEnd: head.end,
    inline: inlineOf(ctx, own),
    selfClosing: tokens.some((t) => t.type === 'slash') || SELF_CLOSING_TAGS.has(tag),
    indent: info?.indent ?? 0,
    lineStart: ctx.starts[line - 1] ?? 0,
    lineEnd: (ctx.starts[line] ?? ctx.text.length + 1) - 1,
    blockEnd: ctx.starts[lastLine] ?? ctx.text.length,
    expanded,
    ...codeContext(ctx.lines, line),
    childLines: block,
  };
  return { element, next: colon < 0 ? undefined : head.next + colon + 1 };
}

/** Reads the elements of a .pug file; throws Pug's own error when it is not valid Pug. */
export function readPugMarkup(text: string, filename: string): PugDocument {
  const tokens = lex(text, filename);
  const starts = lineStartsOf(text);
  const ctx: Ctx = { text, starts, lines: lineInfos(text, starts, tokens) };
  const byLine = new Map<number, Token[]>();
  for (const t of tokens) {
    if (t.type === 'indent' || t.type === 'outdent' || t.type === 'newline' || t.type === 'eos')
      continue;
    const list = byLine.get(t.loc.start.line) ?? [];
    list.push(t);
    byLine.set(t.loc.start.line, list);
  }
  const elements: PugElement[] = [];
  for (const lineTokens of byLine.values()) {
    const kind = lineTokens[0]?.type;
    if (kind !== 'tag' && kind !== 'class' && kind !== 'id') continue;
    let at: number | undefined = 0;
    let expanded = false;
    while (at !== undefined) {
      const made = makeElement(ctx, lineTokens, at, expanded);
      if (made === undefined) break;
      elements.push(made.element);
      at = made.next;
      expanded = true;
    }
  }
  return { text, elements, lines: ctx.lines, lineStarts: starts };
}
