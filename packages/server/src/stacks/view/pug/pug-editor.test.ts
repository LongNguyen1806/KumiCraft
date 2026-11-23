// The Pug editor (03d section 4) on real files: what the Inspector reads, and that each edit keeps
// how the user writes Pug (shorthand classes, inline text) and never rewrites code.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { StylingReport } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SourceEditorService } from '../../../kernel/editing.ts';
import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { createPugEditor } from './editor.ts';

const FILE = 'views/index.pug';
const VIEW = [
  'extends layout',
  '',
  'block content',
  '  h1.hero-title Sản phẩm hôm nay',
  '  p.lead(class=extra) Hi #{name}',
  '  section.cards',
  '    each product in products',
  '      article.card= product.name',
  '  footer',
  '    | Liên hệ',
  '',
].join('\n');

let root: string;
let editor: SourceEditorService;
let styling: StylingReport | undefined;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'rc-pug-editor-'));
  await mkdir(dirname(join(root, FILE)), { recursive: true });
  await writeFile(join(root, FILE), VIEW);
  styling = {
    systems: [{ id: 'css' }],
    primary: 'css',
    editable: false,
    globalCss: ['public/style.css'],
  };
  editor = createPugEditor({ fs: directWriteFs, styling: () => styling });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const text = async () => readFile(join(root, FILE), 'utf8');

describe('Pug editor [03d 4]', () => {
  it('reads classes, text and code as the Inspector shows them', async () => {
    const h1 = await editor.getElement(root, `${FILE}:4:3`);
    expect(h1.ok && h1.value.className).toEqual({ kind: 'static', value: 'hero-title' });
    expect(h1.ok && h1.value.text).toEqual({ kind: 'static', value: 'Sản phẩm hôm nay' });
    const p = await editor.getElement(root, `${FILE}:5:3`);
    expect(p.ok && p.value.className).toEqual({ kind: 'expression', code: 'extra' });
    expect(p.ok && p.value.text).toEqual({ kind: 'mixed' });
    const card = await editor.getElement(root, `${FILE}:8:7`);
    expect(card.ok && card.value.inLoop).toBe(true);
    expect(card.ok && card.value.text.kind).toBe('expression');
    const footer = await editor.getElement(root, `${FILE}:9:3`);
    expect(footer.ok && footer.value.text).toEqual({ kind: 'static', value: 'Liên hệ' });
  });

  it('writes classes as shorthand, or as class="…" when Pug cannot (Tailwind variants)', async () => {
    await editor.applyEdit(root, {
      kind: 'setClassName',
      loc: `${FILE}:4:3`,
      tag: 'h1',
      after: 'hero-title big',
    });
    expect(await text()).toContain('  h1.hero-title.big Sản phẩm hôm nay');
    await editor.applyEdit(root, {
      kind: 'setClassName',
      loc: `${FILE}:4:3`,
      tag: 'h1',
      after: 'text-4xl md:text-6xl',
    });
    expect(await text()).toContain('  h1(class="text-4xl md:text-6xl") Sản phẩm hôm nay');
    const refused = await editor.applyEdit(root, {
      kind: 'setClassName',
      loc: `${FILE}:5:3`,
      tag: 'p',
      after: 'x',
    });
    expect(!refused.ok && refused.error.params?.['reason']).toBe('classExpression');
  });

  it('edits inline and piped text (markup and #{ escaped), attributes and the tag', async () => {
    await editor.applyEdit(root, {
      kind: 'setText',
      loc: `${FILE}:4:3`,
      tag: 'h1',
      before: 'Sản phẩm hôm nay',
      after: 'A <b> #{x}',
    });
    expect(await text()).toContain('  h1.hero-title A &lt;b&gt; \\#{x}');
    await editor.applyEdit(root, {
      kind: 'setText',
      loc: `${FILE}:9:3`,
      tag: 'footer',
      before: 'Liên hệ',
      after: 'Hỏi đáp',
    });
    expect(await text()).toContain('    | Hỏi đáp');
    await editor.applyEdit(root, {
      kind: 'setAttribute',
      loc: `${FILE}:9:3`,
      tag: 'footer',
      name: 'id',
      after: 'end',
    });
    await editor.applyEdit(root, {
      kind: 'setTag',
      loc: `${FILE}:9:3`,
      tag: 'footer',
      after: 'aside',
    });
    expect(await text()).toContain('  aside(id="end")\n    | Hỏi đáp');
  });

  it('inserts a library block as readable Pug lines under the element', async () => {
    const res = await editor.applyStructureEdit(root, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: `${FILE}:4:3`, tag: 'h1' }, where: 'after' },
      jsx: '<section className="py-5"><h2>Hi</h2><a href="/x">Go</a></section>',
    });
    expect(res.ok && res.value.locs).toEqual([`${FILE}:5:3`]);
    expect(await text()).toContain(
      '  h1.hero-title Sản phẩm hôm nay\n  section.py-5\n    h2 Hi\n    a(href="/x") Go\n  p.lead',
    );
  });

  it('duplicates, wraps (project style), removes whole blocks, and keeps loops whole', async () => {
    await editor.applyStructureEdit(root, {
      kind: 'duplicate',
      elements: [{ loc: `${FILE}:6:3`, tag: 'section' }],
    });
    expect((await text()).match(/section\.cards/g)?.length).toBe(2);
    await editor.applyStructureEdit(root, {
      kind: 'remove',
      elements: [{ loc: `${FILE}:9:3`, tag: 'section' }],
    });
    expect((await text()).match(/section\.cards/g)?.length).toBe(1);
    await editor.applyStructureEdit(root, {
      kind: 'wrap',
      elements: [{ loc: `${FILE}:4:3`, tag: 'h1' }],
      wrapper: 'row',
    });
    expect(await text()).toContain(
      '  div(style="display:flex;flex-direction:row;gap:1rem")\n    h1.hero-title',
    );
    const moved = await editor.applyStructureEdit(root, {
      kind: 'move',
      elements: [{ loc: `${FILE}:9:7`, tag: 'article' }],
      target: { kind: 'sibling', ref: { loc: `${FILE}:4:3`, tag: 'div' }, where: 'after' },
    });
    expect(!moved.ok && moved.error.params?.['reason']).toBe('crossesCode');
  });
});
