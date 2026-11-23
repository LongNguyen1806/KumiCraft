// The Pug reader finds exactly the elements the Canvas stamps (03d section 1): every
// `data-rc-loc` pug-loc-plugin writes names an element the reader has at that line and column.
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hookPug } from '../../runners/pug-loc-plugin.ts';
import { readPugMarkup } from './markup.ts';

const FIXTURE = join(process.cwd(), 'fixtures/projects/express-pug');
const TRICKY = [
  'mixin box(t)',
  '  section.box',
  '    h2= t',
  'div',
  '  .card.p-4(data-x="1") Hi',
  '  ul#list',
  '    each item in items',
  '      li.item(class=item.cls)= item.name',
  '    li: a(href="/a") Link',
  '  a(href="/b").late Late',
  '  p',
  '    | piped',
  '  +box("t")',
  '',
].join('\n');

let root: string;
type Compile = (path: string, options?: unknown) => (locals?: unknown) => string;
let compileFile: Compile;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'rc-pug-markup-'));
  await cp(FIXTURE, root, { recursive: true, filter: (s) => !s.includes('node_modules') });
  await writeFile(join(root, 'views/tricky.pug'), TRICKY);
  const pug = createRequire(join(FIXTURE, 'package.json'))('pug') as Record<string, unknown>;
  hookPug(root, pug);
  compileFile = pug['compileFile'] as Compile;
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function stamps(html: string): string[] {
  return [...html.matchAll(/data-rc-loc="([^"]+)"/g)].map((m) => m[1] ?? '');
}

describe('Pug reader matches the Canvas stamps [03d 1]', () => {
  it('finds an element at every stamped line and column, with its tag', () => {
    const html = compileFile(join(root, 'views/tricky.pug'))({ items: [{ cls: 'a', name: 'A' }] });
    const doc = readPugMarkup(TRICKY, 'views/tricky.pug');
    const found = stamps(html).map((loc) => {
      const [, line, col] = /:(\d+):(\d+)$/.exec(loc) ?? [];
      const el = doc.elements.find((e) => e.line === Number(line) && e.col === Number(col));
      return `${loc} ${el?.tag ?? 'MISSING'}`;
    });
    expect(found).toEqual([
      'views/tricky.pug:4:1 div',
      'views/tricky.pug:5:3 div',
      'views/tricky.pug:6:3 ul',
      'views/tricky.pug:8:7 li',
      'views/tricky.pug:9:5 li',
      'views/tricky.pug:9:9 a',
      'views/tricky.pug:10:3 a',
      'views/tricky.pug:11:3 p',
      'views/tricky.pug:2:3 section',
      'views/tricky.pug:3:5 h2',
    ]);
  });

  it('reads classes, inline text and code, loops and blocks', () => {
    const doc = readPugMarkup(TRICKY, 'views/tricky.pug');
    const at = (line: number, col: number) =>
      doc.elements.find((e) => e.line === line && e.col === col);
    expect(at(5, 3)?.parts.map((p) => p.name)).toEqual(['card', 'p-4']);
    expect(at(5, 3)?.inline).toMatchObject({ kind: 'text', value: 'Hi' });
    expect(at(8, 7)?.inline.kind).toBe('code');
    expect(at(8, 7)?.loop).toBe(true);
    expect(at(9, 9)?.expanded).toBe(true);
    expect(TRICKY.slice(at(6, 3)?.lineStart, at(6, 3)?.blockEnd)).toBe(
      '  ul#list\n    each item in items\n      li.item(class=item.cls)= item.name\n    li: a(href="/a") Link\n',
    );
  });

  it('matches the stamps of the sample app views', async () => {
    const html = compileFile(join(root, 'views/index.pug'), { basedir: join(root, 'views') })({
      title: 'x',
      products: [{ id: 1, name: 'n', price: 'p' }],
    });
    for (const loc of stamps(html)) {
      const [, file, line, col] = /^(.*):(\d+):(\d+)$/.exec(loc) ?? [];
      const text = await readFile(join(root, file ?? ''), 'utf8');
      const doc = readPugMarkup(text, file ?? '');
      expect(
        doc.elements.some((e) => e.line === Number(line) && e.col === Number(col)),
        loc,
      ).toBe(true);
    }
  });
});
