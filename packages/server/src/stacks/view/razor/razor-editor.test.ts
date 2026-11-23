// The Razor editor (03c sections 3.3, 4) on real files: what the Inspector reads, and that each edit
// changes only HTML characters of the .cshtml, keeping C# and the BOM as they were. The C# ranges
// are the ones the Razor helper returns for these texts.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { StylingReport } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SourceEditorService } from '../../../kernel/editing.ts';
import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { createRazorEditor } from './editor.ts';

const FILE = 'Pages/Index.cshtml';
const BOM = '﻿';
const VIEW = [
  '@page',
  '<div class="text-center">',
  '    <h1 class="display-4">Welcome</h1>',
  '    <p class="lead @(on ? "on" : "")">Hi @Model.Name</p>',
  '    <ul>',
  '        @foreach (var x in Model.Items)',
  '        {',
  '            <li>@x</li>',
  '        }',
  '    </ul>',
  '</div>',
  '',
].join('\r\n');
const CODE = [
  '@page\r\n',
  ' @(on ? "on" : "")',
  '@Model.Name',
  '@foreach (var x in Model.Items)\r\n        {\r\n',
  '@x',
  '}\r\n',
];

/** What the helper returns for VIEW: these pieces, in order, are C#. */
function codeRanges(_root: string, _file: string, text: string) {
  let from = 0;
  const out: { start: number; end: number }[] = [];
  for (const piece of CODE) {
    const start = text.indexOf(piece, from);
    if (start < 0) continue;
    from = start + piece.length;
    out.push({ start, end: from });
  }
  return Promise.resolve(out);
}

let root: string;
let editor: SourceEditorService;
let styling: StylingReport | undefined;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'rc-razor-editor-'));
  await mkdir(dirname(join(root, FILE)), { recursive: true });
  await writeFile(join(root, FILE), BOM + VIEW);
  styling = {
    systems: [{ id: 'bootstrap' }],
    primary: 'bootstrap',
    editable: false,
    globalCss: [],
  };
  editor = createRazorEditor({ fs: directWriteFs, codeRanges, styling: () => styling });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const text = async () => readFile(join(root, FILE), 'utf8');

describe('Razor editor [03c 4]', () => {
  it('reads classes, text and loops as the Inspector shows them', async () => {
    const h1 = await editor.getElement(root, `${FILE}:3:5`);
    expect(h1.ok && h1.value.className).toEqual({ kind: 'static', value: 'display-4' });
    expect(h1.ok && h1.value.text).toEqual({ kind: 'static', value: 'Welcome' });
    const p = await editor.getElement(root, `${FILE}:4:5`);
    expect(p.ok && p.value.className).toEqual({
      kind: 'templateStatic',
      value: 'lead',
      rest: ' @(on ? "on" : "")',
    });
    expect(p.ok && p.value.text).toEqual({ kind: 'mixed' });
    const li = await editor.getElement(root, `${FILE}:8:13`);
    expect(li.ok && li.value.inLoop).toBe(true);
  });

  it('edits written classes and keeps the C# part and the BOM', async () => {
    const res = await editor.applyEdit(root, {
      kind: 'setClassName',
      loc: `${FILE}:4:5`,
      tag: 'p',
      after: 'lead mb-3',
    });
    expect(res.ok ? 'ok' : JSON.stringify(res.error)).toBe('ok');
    const after = await text();
    expect(after.startsWith(BOM)).toBe(true);
    expect(after).toContain('<p class="lead mb-3 @(on ? "on" : "")">');
  });

  it('edits text (an @ is written @@) and refuses text that is C#', async () => {
    await editor.applyEdit(root, {
      kind: 'setText',
      loc: `${FILE}:3:5`,
      tag: 'h1',
      before: 'Welcome',
      after: 'Mail us @ home',
    });
    expect(await text()).toContain('<h1 class="display-4">Mail us @@ home</h1>');
    const refused = await editor.applyEdit(root, {
      kind: 'setText',
      loc: `${FILE}:8:13`,
      tag: 'li',
      before: '',
      after: 'x',
    });
    expect(!refused.ok && refused.error.params?.['reason']).toBe('textExpression');
  });

  it('adds an attribute and changes a tag with its end tag', async () => {
    await editor.applyEdit(root, {
      kind: 'setAttribute',
      loc: `${FILE}:3:5`,
      tag: 'h1',
      name: 'id',
      after: 'hero',
    });
    await editor.applyEdit(root, { kind: 'setTag', loc: `${FILE}:3:5`, tag: 'h1', after: 'h2' });
    expect(await text()).toContain('<h2 class="display-4" id="hero">Welcome</h2>');
  });

  it('inserts a library block laid out on its own lines, after the element', async () => {
    const res = await editor.applyStructureEdit(root, {
      kind: 'insert',
      target: { kind: 'sibling', ref: { loc: `${FILE}:3:5`, tag: 'h1' }, where: 'after' },
      jsx: '<section className="py-5"><h2>Hi</h2><p>a@b</p></section>',
    });
    expect(res.ok && res.value.locs).toEqual([`${FILE}:4:5`]);
    expect(await text()).toContain(
      '    <h1 class="display-4">Welcome</h1>\r\n    <section class="py-5">\r\n        <h2>Hi</h2>\r\n        <p>a@@b</p>\r\n    </section>\r\n    <p class="lead',
    );
  });

  it('removes an element with its line, wraps in the project style system, and keeps loops whole', async () => {
    await editor.applyStructureEdit(root, {
      kind: 'wrap',
      elements: [{ loc: `${FILE}:3:5`, tag: 'h1' }],
      wrapper: 'row',
    });
    expect(await text()).toContain(
      '<div class="d-flex flex-row gap-3">\r\n        <h1 class="display-4">',
    );
    const moved = await editor.applyStructureEdit(root, {
      kind: 'move',
      elements: [{ loc: `${FILE}:10:13`, tag: 'li' }],
      target: { kind: 'sibling', ref: { loc: `${FILE}:6:5`, tag: 'p' }, where: 'after' },
    });
    expect(!moved.ok && moved.error.params?.['reason']).toBe('crossesCode');
    await editor.applyStructureEdit(root, {
      kind: 'remove',
      elements: [{ loc: `${FILE}:6:5`, tag: 'p' }],
    });
    expect(await text()).not.toContain('<p class="lead');
    expect(await text()).toContain('</div>\r\n    <ul>');
  });
});
