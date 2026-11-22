// One style test suite for every style system (03 section 6.4, round S): the same Inspector changes
// are written to a real project by Tailwind (classes, through the class edit intents) and by plain CSS
// (the rule in the stylesheet), and each system must read back exactly the value it wrote, and
// nothing once the value is dropped.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { type ClassStep, CSS_LONGHAND_OF } from '@kumicraft/shared';
import { type ClassValue, parseClasses, readValue } from '@kumicraft/style-tailwind';
import postcss from 'postcss';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { testClassEdits } from '../../services/edit/class-edits-test-support.ts';
import { nodeFs } from '../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../view/jsx/source-editor-service.ts';
import { applyStyleChange } from './style-apply.ts';

/** A change of one property: its CSS value, and the same value as the Tailwind Inspector sends it. */
type Case = { readonly property: string; readonly css: string; readonly tailwind?: ClassValue };

const CASES: readonly Case[] = [
  { property: 'paddingTop', css: '24px' },
  { property: 'marginLeft', css: '12px' },
  { property: 'width', css: '320px' },
  { property: 'maxWidth', css: '640px' },
  { property: 'fontSize', css: '18px' },
  { property: 'lineHeight', css: '28px' },
  { property: 'fontWeight', css: '600' },
  { property: 'textColor', css: '#112233' },
  { property: 'backgroundColor', css: '#fafafa' },
  { property: 'borderColor', css: '#ff0000' },
  { property: 'borderTopWidth', css: '2px' },
  { property: 'borderRadius', css: '12px' },
  { property: 'opacity', css: '0.5' },
  { property: 'display', css: 'flex', tailwind: { kind: 'keyword', name: 'flex' } },
  { property: 'position', css: 'relative', tailwind: { kind: 'keyword', name: 'relative' } },
  { property: 'textAlign', css: 'center', tailwind: { kind: 'keyword', name: 'center' } },
];

const CARD_TSX = `import './Card.css';

export function Card() {
  return (
    <article className="card">
      <h3>Title</h3>
    </article>
  );
}
`;
const CARD_CSS = `.card {
  margin: 0;
}
`;
const LOC = 'src/Card.tsx:5:5';

/** One style system as the suite drives it: write a value (or drop it), read what the project holds. */
type System = {
  readonly name: string;
  readonly write: (root: string, c: Case, value: string | undefined) => Promise<void>;
  readonly read: (root: string, c: Case) => Promise<string | undefined>;
};

const sourceEditor = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
const classEdits = testClassEdits();
const CTX = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'desktop-first' as const,
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
  major: 4 as const,
};

async function staticClass(root: string): Promise<string> {
  const element = await sourceEditor.getElement(root, LOC);
  if (!element.ok || element.value.className.kind !== 'static') throw new Error('no class');
  return element.value.className.value;
}

const tailwind: System = {
  name: 'Tailwind (classes)',
  async write(root, c, value) {
    const step: ClassStep = {
      kind: 'value',
      property: c.property,
      scope: { breakpoint: 'base' },
      value: value === undefined ? undefined : (c.tailwind ?? { kind: 'arbitrary', css: value }),
    };
    const before = await staticClass(root);
    const resolved = await classEdits.resolve([
      { kind: 'setClasses', loc: LOC, tag: 'article', before, steps: [step] },
    ]);
    if (!resolved.ok) throw new Error(resolved.error.code);
    const [edit] = resolved.value;
    if (edit === undefined) throw new Error('no edit');
    const written = await sourceEditor.applyEdit(root, edit);
    if (!written.ok) throw new Error(written.error.code);
  },
  async read(root, c) {
    const value = readValue(
      parseClasses(await staticClass(root), CTX),
      c.property,
      { width: 1280 },
      CTX,
    ).value;
    if (value === undefined) return undefined;
    if (value.kind === 'arbitrary') return value.css;
    // A keyword reads back as the CSS value of the case only when it is the keyword written.
    const written = c.tailwind;
    if (value.kind === 'keyword' && written?.kind === 'keyword' && value.name === written.name) {
      return c.css;
    }
    return JSON.stringify(value);
  },
};

const css: System = {
  name: 'plain CSS (stylesheet rule)',
  async write(root, c, value) {
    const res = await applyStyleChange(
      {
        fs: nodeFs,
        sourceEditor,
        newId: () => 'ab10',
      },
      root,
      {
        probe: {
          ref: { loc: LOC, index: 0 },
          found: true,
          rules: [
            {
              sheet: { kind: 'module', id: path.join(root, 'src/Card.css').replaceAll('\\', '/') },
              selector: '.card',
              media: [],
              occurrence: 0,
              ruleIndex: 0,
              declarations: [],
              affects: 1,
            },
          ],
          inline: [],
          computed: {},
        },
        tag: 'article',
        change: { property: c.property, value, target: 'rule' },
      },
    );
    if (!res.ok) throw new Error(res.error.code);
  },
  async read(root, c) {
    const cssName = CSS_LONGHAND_OF[c.property];
    const sheet = postcss.parse(await fs.readFile(path.join(root, 'src/Card.css'), 'utf8'));
    let found: string | undefined;
    sheet.walkRules('.card', (rule) => {
      rule.walkDecls(cssName ?? '', (decl) => {
        found = decl.value;
      });
    });
    return found;
  },
};

describe.each([tailwind, css])('style system contract: $name [03 section 6.4]', (system) => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-style-contract-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/Card.tsx'), CARD_TSX);
    await fs.writeFile(path.join(root, 'src/Card.css'), CARD_CSS);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it.each(CASES)('reads back the $property it wrote, and nothing once it is dropped', async (c) => {
    await system.write(root, c, c.css);
    expect(await system.read(root, c)).toBe(c.css);

    await system.write(root, c, undefined);
    expect(await system.read(root, c)).toBeUndefined();
  });

  it('a second value of the same property replaces the first', async () => {
    const c: Case = { property: 'paddingTop', css: '8px' };
    await system.write(root, c, '8px');
    await system.write(root, c, '32px');
    expect(await system.read(root, c)).toBe('32px');
  });
});
