// Writing Inspector changes to plain CSS (SPEC-04 M-ST, R-ST-06 to R-ST-09, R-ST-15).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  type BridgeStyleProbePayload,
  type MatchedRule,
  type StyleChange,
  StyleChangeSchema,
} from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSourceEditorService } from '../source-editor/source-editor-service.ts';
import { nodeFs } from '../workspace/test-support.ts';
import { applyStyleChange } from './style-apply.ts';

const CARD_CSS = `.card {
  padding: 16px;
}

@media (max-width: 639px) {
  .note {
    color: red;
  }
}
`;
const CARD_TSX = `import './Card.css';

export function Card() {
  return (
    <article className="card">
      <h3>Title</h3>
    </article>
  );
}
`;

describe('applyStyleChange [R-ST-06, R-ST-09]', () => {
  let root: string;

  beforeEach(async () => {
    ids = 0;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-style-apply-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/Card.css'), CARD_CSS);
    await fs.writeFile(path.join(root, 'src/Card.tsx'), CARD_TSX);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const read = (rel: string) => fs.readFile(path.join(root, rel), 'utf8');
  const cardRule = (over: Partial<MatchedRule> = {}): MatchedRule => ({
    sheet: { kind: 'module', id: path.join(root, 'src/Card.css').replaceAll('\\', '/') },
    selector: '.card',
    media: [],
    occurrence: 0,
    ruleIndex: 0,
    declarations: [{ property: 'padding-top', value: '16px', important: false }],
    affects: 3,
    ...over,
  });
  const probe = (loc: string, rules: MatchedRule[]): BridgeStyleProbePayload => ({
    ref: { loc, index: 0 },
    found: true,
    rules,
    inline: [],
    computed: {},
  });
  let ids = 0;
  const deps = () => ({
    fs: nodeFs,
    sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
    newId: () => `ab1${String(ids++)}`,
  });
  const apply = (rules: MatchedRule[], change: StyleChange, loc = 'src/Card.tsx:5:5') =>
    applyStyleChange(deps(), root, { probe: probe(loc, rules), tag: 'article', change });

  it('"all N elements" changes the winning rule only, as one written file with its old bytes [R-ST-15]', async () => {
    const res = await apply([cardRule()], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
    });

    expect(res.ok && res.value.files.map((f) => [f.path, f.before])).toEqual([
      ['src/Card.css', CARD_CSS],
    ]);
    expect(await read('src/Card.css')).toBe(
      CARD_CSS.replace('padding: 16px;', 'padding: 16px;\n  padding-top: 24px;'),
    );
    expect(await read('src/Card.tsx')).toBe(CARD_TSX);
  });

  it("on a smaller frame puts the same selector inside the frame's @media", async () => {
    await apply([cardRule()], {
      property: 'paddingTop',
      value: '8px',
      target: 'rule',
      media: '(max-width: 639px)',
    });

    expect(await read('src/Card.css')).toBe(
      CARD_CSS.replace(
        '    color: red;\n  }\n}',
        '    color: red;\n  }\n\n  .card {\n    padding-top: 8px;\n  }\n}',
      ),
    );
  });

  it('on a smaller frame changes a winning rule that is already under @media in place', async () => {
    const note = cardRule({
      selector: '.note',
      media: ['(max-width: 639px)'],
      declarations: [{ property: 'color', value: 'red', important: false }],
    });
    await apply([note], {
      property: 'textColor',
      value: 'blue',
      target: 'rule',
      media: '(max-width: 639px)',
    });

    expect(await read('src/Card.css')).toBe(CARD_CSS.replace('color: red;', 'color: blue;'));
  });

  it('"only this element" gives it a class of its own and a stronger rule, then reuses that class', async () => {
    const first = await apply([cardRule()], {
      property: 'paddingTop',
      value: '24px',
      target: 'element',
    });

    expect(first.ok && first.value.className).toBe('card-ab10');
    expect(first.ok && first.value.files.map((f) => f.path).sort()).toEqual([
      'src/Card.css',
      'src/Card.tsx',
    ]);
    expect(await read('src/Card.tsx')).toContain('className="card card-ab10"');
    expect(await read('src/Card.css')).toBe(
      `${CARD_CSS}\n.card.card-ab10 {\n  padding-top: 24px;\n}\n`,
    );

    const own = cardRule({ selector: '.card.card-ab10', occurrence: 0 });
    await apply([own, cardRule()], { property: 'paddingTop', value: '30px', target: 'element' });
    expect(await read('src/Card.css')).toBe(
      `${CARD_CSS}\n.card.card-ab10 {\n  padding-top: 30px;\n}\n`,
    );
  });

  it('creates <File>.css beside a component that imports no CSS, and imports it', async () => {
    await fs.writeFile(
      path.join(root, 'src/Plain.tsx'),
      'export function Plain() {\n  return <p>Hi</p>;\n}\n',
    );

    const res = await apply(
      [],
      { property: 'textColor', value: 'red', target: 'element' },
      'src/Plain.tsx:2:10',
    );

    expect(res.ok && res.value.files.find((f) => f.path === 'src/Plain.css')).toMatchObject({
      before: undefined,
    });
    expect(await read('src/Plain.tsx')).toBe(
      'import \'./Plain.css\';\nexport function Plain() {\n  return <p className="p-ab10">Hi</p>;\n}\n',
    );
    expect(await read('src/Plain.css')).toBe('.p-ab10 {\n  color: red;\n}\n');
  });

  it('refuses a className that is an expression (L-01) and a value that would close the rule', async () => {
    await fs.writeFile(
      path.join(root, 'src/Dyn.tsx'),
      'export function Dyn({ c }: { c: string }) {\n  return <p className={c}>Hi</p>;\n}\n',
    );
    const res = await apply(
      [],
      { property: 'textColor', value: 'red', target: 'element' },
      'src/Dyn.tsx:2:10',
    );

    expect(res.ok ? undefined : res.error.params).toEqual({ reason: 'expression' });
    expect(
      StyleChangeSchema.safeParse({ property: 'textColor', value: 'red; } body {', target: 'rule' })
        .success,
    ).toBe(false);
  });
});
