// Reads the static JSX of a library block into the neutral tree (03b section 2.2). Only what blocks
// use: lowercase tags, string or literal attributes, text, string literals in braces, comments.
// Anything else (a component, a loop, a variable) is refused, so a block that leaves the subset
// fails its test at once instead of rendering wrong in another language.
import { decodeEntities } from './entities.ts';
import { type TreeAttr, type TreeAttrValue, type TreeNode, TreeParseError } from './tree.ts';

const NAME = /[A-Za-z_][\w:.-]*/y;

/** JSX folds the whitespace of a text run like Babel's `cleanJSXElementLiteralChild`. */
export function foldJsxText(raw: string): string {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = -1;
  lines.forEach((line, i) => {
    if (/[^ \t]/.test(line)) lastNonEmpty = i;
  });
  let out = '';
  lines.forEach((line, i) => {
    let trimmed = line.replaceAll('\t', ' ');
    if (i !== 0) trimmed = trimmed.replace(/^ +/, '');
    if (i !== lines.length - 1) trimmed = trimmed.replace(/ +$/, '');
    if (trimmed === '') return;
    out += i === lastNonEmpty ? trimmed : `${trimmed} `;
  });
  return out;
}

class Reader {
  pos = 0;
  readonly src: string;

  constructor(src: string) {
    this.src = src;
  }

  peek(text: string): boolean {
    return this.src.startsWith(text, this.pos);
  }

  expect(text: string): void {
    if (!this.peek(text)) throw new TreeParseError(`expected "${text}"`, this.pos);
    this.pos += text.length;
  }

  skipSpace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src.charAt(this.pos))) this.pos += 1;
  }

  name(): string {
    NAME.lastIndex = this.pos;
    const m = NAME.exec(this.src);
    if (!m) throw new TreeParseError('expected a name', this.pos);
    this.pos += m[0].length;
    return m[0];
  }

  /** A string literal in braces or an attribute: '…', "…", or `…` without `${`. */
  quoted(): string {
    const quote = this.src.charAt(this.pos);
    if (quote !== '"' && quote !== "'" && quote !== '`') {
      throw new TreeParseError('expected a string', this.pos);
    }
    const end = this.src.indexOf(quote, this.pos + 1);
    if (end < 0) throw new TreeParseError('unclosed string', this.pos);
    const body = this.src.slice(this.pos + 1, end);
    if (quote === '`' && body.includes('${')) throw new TreeParseError('template', this.pos);
    if (body.includes('\\')) throw new TreeParseError('escape in a literal', this.pos);
    this.pos = end + 1;
    return body;
  }
}

/** The value inside `{…}` of an attribute: a string, a number, or true / false. */
function literal(r: Reader): TreeAttrValue {
  r.skipSpace();
  const rest = r.src.slice(r.pos);
  const num = /^-?\d+(\.\d+)?/.exec(rest);
  let value: TreeAttrValue;
  if (num) {
    r.pos += num[0].length;
    value = { kind: 'number', value: Number(num[0]) };
  } else if (rest.startsWith('true') || rest.startsWith('false')) {
    const on = rest.startsWith('true');
    r.pos += on ? 4 : 5;
    value = { kind: 'boolean', value: on };
  } else {
    value = { kind: 'string', value: r.quoted() };
  }
  r.skipSpace();
  r.expect('}');
  return value;
}

function attribute(r: Reader): TreeAttr {
  const name = r.name();
  r.skipSpace();
  if (!r.peek('=')) return { name, value: { kind: 'boolean', value: true } };
  r.expect('=');
  r.skipSpace();
  if (r.peek('{')) {
    r.expect('{');
    return { name, value: literal(r) };
  }
  return { name, value: { kind: 'string', value: decodeEntities(r.quoted()) } };
}

/** `{/* … *\/}` is skipped; `{'…'}` is text kept as written (JSX does not fold it). */
function braceChild(r: Reader): string | undefined {
  r.expect('{');
  r.skipSpace();
  if (r.peek('/*')) {
    const end = r.src.indexOf('*/', r.pos);
    if (end < 0) throw new TreeParseError('unclosed comment', r.pos);
    r.pos = end + 2;
    r.skipSpace();
    r.expect('}');
    return undefined;
  }
  const text = r.quoted();
  r.skipSpace();
  r.expect('}');
  return text;
}

function pushText(children: TreeNode[], value: string): void {
  if (value === '') return;
  const last = children.at(-1);
  if (last?.kind === 'text') {
    children[children.length - 1] = { kind: 'text', value: last.value + value };
  } else {
    children.push({ kind: 'text', value });
  }
}

function children(r: Reader, tag: string): TreeNode[] {
  const out: TreeNode[] = [];
  for (;;) {
    if (r.pos >= r.src.length) throw new TreeParseError(`unclosed <${tag}>`, r.pos);
    if (r.peek('</')) {
      r.expect('</');
      r.skipSpace();
      if (r.name() !== tag) throw new TreeParseError(`mismatched </${tag}>`, r.pos);
      r.skipSpace();
      r.expect('>');
      return out;
    }
    if (r.peek('<')) {
      out.push(element(r));
    } else if (r.peek('{')) {
      const text = braceChild(r);
      if (text !== undefined) pushText(out, text);
    } else {
      const next = r.src.slice(r.pos).search(/[<{]/);
      const end = next < 0 ? r.src.length : r.pos + next;
      pushText(out, decodeEntities(foldJsxText(r.src.slice(r.pos, end))));
      r.pos = end;
    }
  }
}

function element(r: Reader): TreeNode {
  r.expect('<');
  const tag = r.name();
  if (/^[A-Z]/.test(tag) || tag.includes('.')) {
    throw new TreeParseError(`component <${tag}> is not static markup`, r.pos);
  }
  const attrs: TreeAttr[] = [];
  for (;;) {
    r.skipSpace();
    if (r.peek('/>')) {
      r.expect('/>');
      return { kind: 'element', tag, attrs, children: [] };
    }
    if (r.peek('>')) {
      r.expect('>');
      return { kind: 'element', tag, attrs, children: children(r, tag) };
    }
    if (r.peek('{')) throw new TreeParseError('spread attributes', r.pos);
    attrs.push(attribute(r));
  }
}

/** Every top-level element of the block (most blocks have one). */
export function parseBlockJsx(source: string): TreeNode[] {
  const r = new Reader(source);
  const out: TreeNode[] = [];
  for (;;) {
    r.skipSpace();
    if (r.pos >= source.length) return out;
    if (!r.peek('<')) throw new TreeParseError('expected an element', r.pos);
    out.push(element(r));
  }
}
