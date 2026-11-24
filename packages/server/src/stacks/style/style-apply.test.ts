// Writing Inspector changes to plain CSS (SPEC-04 M-ST, R-ST-06 to R-ST-09, R-ST-15).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  type BridgeStyleProbePayload,
  type MatchedRule,
  type StyleChange,
  StyleChangeSchema,
} from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nodeFs } from '../../services/workspace/test-support.ts';
import { createSourceEditorService } from '../view/jsx/source-editor-service.ts';
import { applyStyleChange, planCssFile } from './style-apply.ts';

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

  it('adds .btn-buy:hover on first hover edit and updates it in place on second edit [R-ST-09]', async () => {
    const btnCss = `.btn-buy {\n  background-color: #0d6efd;\n}\n`;
    await fs.writeFile(path.join(root, 'src/Card.css'), btnCss);
    const btnRule = cardRule({
      selector: '.btn-buy',
      declarations: [{ property: 'background-color', value: '#0d6efd', important: false }],
    });

    await apply([btnRule], {
      property: 'backgroundColor',
      value: '#084298',
      target: 'rule',
      state: 'hover',
    });
    expect(await read('src/Card.css')).toBe(
      `${btnCss}\n.btn-buy:hover {\n  background-color: #084298;\n}\n`,
    );

    const hoverRule = cardRule({
      selector: '.btn-buy:hover',
      ruleIndex: 1,
      declarations: [{ property: 'background-color', value: '#084298', important: false }],
    });
    await apply([hoverRule, btnRule], {
      property: 'backgroundColor',
      value: '#052c65',
      target: 'rule',
      state: 'hover',
    });
    expect(await read('src/Card.css')).toBe(
      `${btnCss}\n.btn-buy:hover {\n  background-color: #052c65;\n}\n`,
    );
  });

  it('writes .<own-class>:focus for target element with state focus and reuses the own class [R-ST-09]', async () => {
    const first = await apply([cardRule()], {
      property: 'paddingTop',
      value: '24px',
      target: 'element',
      state: 'focus',
    });

    expect(first.ok && first.value.className).toBe('card-ab10');
    expect(await read('src/Card.tsx')).toContain('className="card card-ab10"');
    expect(await read('src/Card.css')).toBe(
      `${CARD_CSS}\n.card.card-ab10:focus {\n  padding-top: 24px;\n}\n`,
    );

    const ownFocus = cardRule({ selector: '.card.card-ab10:focus', occurrence: 0 });
    await apply([ownFocus, cardRule()], {
      property: 'paddingTop',
      value: '32px',
      target: 'element',
      state: 'focus',
    });
    expect(await read('src/Card.tsx')).toContain('className="card card-ab10"');
    expect(await read('src/Card.css')).toBe(
      `${CARD_CSS}\n.card.card-ab10:focus {\n  padding-top: 32px;\n}\n`,
    );
  });

  it('.scss "tất cả" sửa khai báo trong rule lồng; comment // và phần còn lại giữ từng byte [R-ST-06]', async () => {
    const scssCode = `// Header comment
.card {
  padding: 16px; // inner comment
  .title {
    font-size: 18px;
  }
}
`;
    await fs.writeFile(path.join(root, 'src/Card.scss'), scssCode);
    const nestedRule: MatchedRule = {
      sheet: { kind: 'module', id: path.join(root, 'src/Card.scss').replaceAll('\\', '/') },
      selector: '.card .title',
      media: [],
      occurrence: 0,
      ruleIndex: 0,
      declarations: [{ property: 'font-size', value: '18px', important: false }],
      affects: 3,
    };

    const res = await apply([nestedRule], {
      property: 'fontSize',
      value: '20px',
      target: 'rule',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const after = await read('src/Card.scss');
    expect(after).toContain('font-size: 20px;');
    expect(after).toContain('// Header comment');
    expect(after).toContain('// inner comment');
    expect(after).toContain('padding: 16px; // inner comment');
  });

  it('.less "chỉ phần tử này" → rule phẳng .card .title.title-xxxx { … } cuối card.less, JSX có class mới [R-ST-06]', async () => {
    const lessCode = `.card {
  padding: 16px;
  .title {
    color: #333;
  }
}
`;
    const lessTsx = `import './card.less';

export function Card() {
  return (
    <article className="card">
      <h3 className="title">Title</h3>
    </article>
  );
}
`;
    await fs.writeFile(path.join(root, 'src/card.less'), lessCode);
    await fs.writeFile(path.join(root, 'src/Card.tsx'), lessTsx);

    const lessRule: MatchedRule = {
      sheet: { kind: 'module', id: path.join(root, 'src/card.less').replaceAll('\\', '/') },
      selector: '.card .title',
      media: [],
      occurrence: 0,
      ruleIndex: 0,
      declarations: [{ property: 'color', value: '#333', important: false }],
      affects: 3,
    };

    const res = await apply(
      [lessRule],
      { property: 'textColor', value: 'red', target: 'element' },
      'src/Card.tsx:6:7',
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.className).toBe('title-ab10');
    const afterTsx = await read('src/Card.tsx');
    expect(afterTsx).toContain('className="title title-ab10"');
    const afterLess = await read('src/card.less');
    expect(afterLess).toContain('.card .title.title-ab10 {\n  color: red;\n}');
  });

  it('.scss "tất cả" ở khung có media, rule thắng là @media lồng → khai báo trong khối @media lồng đổi, phần còn lại giữ từng byte [R-ST-09]', async () => {
    const scssCode = [
      '// Top comment',
      '.card {',
      '  font-size: 16px;',
      '  @media (max-width: 640px) {',
      '    font-size: 14px; // mobile comment',
      '  }',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(path.join(root, 'src/Card.scss'), scssCode);

    const nestedMediaRule: MatchedRule = {
      sheet: { kind: 'module', id: path.join(root, 'src/Card.scss').replaceAll('\\', '/') },
      selector: '.card',
      media: ['(max-width: 640px)'],
      occurrence: 0,
      ruleIndex: 0,
      declarations: [{ property: 'font-size', value: '14px', important: false }],
      affects: 1,
    };

    const res = await apply([nestedMediaRule], {
      property: 'fontSize',
      value: '20px',
      target: 'rule',
      media: '(max-width: 640px)',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Only the declaration inside the nested @media changes; every other byte stays.
    expect(await read('src/Card.scss')).toBe(
      scssCode.replace('font-size: 14px; // mobile', 'font-size: 20px; // mobile'),
    );
  });

  it('Test 10 [WP-4.00]: planCssFile with newCssDir targets src/styles/Home.css and imports ../styles/Home.css; without newCssDir behaves as before', async () => {
    await fs.mkdir(path.join(root, 'src/pages'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'src/pages/Home.tsx'),
      'export function Home() { return <main>Home</main>; }\n',
    );

    // With newCssDir
    const planWithDir = await planCssFile(
      { fs: nodeFs },
      root,
      'src/pages/Home.tsx',
      undefined,
      'src/styles',
    );
    expect(planWithDir.ok).toBe(true);
    if (!planWithDir.ok) return;
    expect(planWithDir.value.file).toBe('src/styles/Home.css');
    expect(planWithDir.value.importAs).toBe('../styles/Home.css');

    // Without newCssDir
    const planDefault = await planCssFile(
      { fs: nodeFs },
      root,
      'src/pages/Home.tsx',
      undefined,
      undefined,
    );
    expect(planDefault.ok).toBe(true);
    if (!planDefault.ok) return;
    expect(planDefault.value.file).toBe('src/pages/Home.css');
    expect(planDefault.value.importAs).toBe('./Home.css');
  });

  it('Test 11 [WP-4.00]: two Home.tsx in different folders with newCssDir -> second file becomes Home-2.css, first unchanged', async () => {
    await fs.mkdir(path.join(root, 'src/pages/shop'), { recursive: true });
    await fs.mkdir(path.join(root, 'src/styles'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'src/pages/Home.tsx'),
      'export function Home() { return <main>Home</main>; }\n',
    );
    await fs.writeFile(
      path.join(root, 'src/pages/shop/Home.tsx'),
      'export function ShopHome() { return <main>Shop</main>; }\n',
    );

    // First file planned and created
    const firstPlan = await planCssFile(
      { fs: nodeFs },
      root,
      'src/pages/Home.tsx',
      undefined,
      'src/styles',
    );
    expect(firstPlan.ok).toBe(true);
    if (!firstPlan.ok) return;
    expect(firstPlan.value.file).toBe('src/styles/Home.css');
    await fs.writeFile(path.join(root, firstPlan.value.file), '/* first */\n');

    // Second file planned -> avoids collision with existing Home.css
    const secondPlan = await planCssFile(
      { fs: nodeFs },
      root,
      'src/pages/shop/Home.tsx',
      undefined,
      'src/styles',
    );
    expect(secondPlan.ok).toBe(true);
    if (!secondPlan.ok) return;
    expect(secondPlan.value.file).toBe('src/styles/Home-2.css');
    expect(secondPlan.value.importAs).toBe('../../styles/Home-2.css');

    // Verify first file untouched
    expect(await fs.readFile(path.join(root, 'src/styles/Home.css'), 'utf8')).toBe('/* first */\n');
  });

  it('planCssFile targets globalCss[0] without importAs for non-JSX (.pug) files', async () => {
    await fs.mkdir(path.join(root, 'views/products'), { recursive: true });
    await fs.writeFile(path.join(root, 'views/products/index.pug'), 'h1 Danh sách sản phẩm\n');
    const plan = await planCssFile(
      { fs: nodeFs },
      root,
      'views/products/index.pug',
      undefined,
      undefined,
      ['public/stylesheets/style.css'],
    );
    expect(plan).toEqual({ ok: true, value: { file: 'public/stylesheets/style.css' } });
  });

  it('edits a <link> stylesheet rule in place when matched via styling.globalCss', async () => {
    await fs.mkdir(path.join(root, 'public/stylesheets'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'public/stylesheets/style.css'),
      '.page-header h1 {\n  font-size: 26px;\n}\n',
    );
    const linkRule: MatchedRule = {
      sheet: { kind: 'link', href: 'http://localhost:60127/stylesheets/style.css' },
      selector: '.page-header h1',
      media: [],
      occurrence: 0,
      ruleIndex: 0,
      declarations: [{ property: 'font-size', value: '26px', important: false }],
      affects: 1,
    };
    const res = await applyStyleChange(
      {
        fs: nodeFs,
        sourceEditor: createSourceEditorService({ fs: nodeFs }),
        styling: {
          systems: [{ id: 'css' }],
          editable: false,
          globalCss: ['public/stylesheets/style.css'],
        },
        newId: () => 'ab01',
      },
      root,
      {
        tag: 'h1',
        probe: {
          found: true,
          rules: [linkRule],
          inline: [],
          computed: { 'font-size': '26px' },
          ref: { loc: 'views/products/index.pug:5:5', index: 0 },
        },
        change: { property: 'fontSize', value: '32px', target: 'rule' },
      },
    );
    expect(res.ok).toBe(true);
    expect(await read('public/stylesheets/style.css')).toContain('font-size: 32px;');
  });

  it('rolls back class edit if a subsequent write fails during applyToElement', async () => {
    const res = await applyStyleChange(
      {
        fs: {
          ...nodeFs,
          writeTextAtomic: (r, relPath, content, opts) => {
            if (relPath.endsWith('Card.css')) {
              return Promise.resolve({
                ok: false,
                error: { code: 'E013', params: { file: relPath } },
              });
            }
            return nodeFs.writeTextAtomic(r, relPath, content, opts);
          },
        },
        sourceEditor: createSourceEditorService({ fs: nodeFs }),
        styling: { systems: [{ id: 'css' }], editable: true, globalCss: ['src/Card.css'] },
        newId: () => 'fail',
      },
      root,
      {
        tag: 'h3',
        probe: {
          found: true,
          rules: [],
          inline: [],
          computed: { 'font-size': '16px' },
          ref: { loc: 'src/Card.tsx:6:7', index: 0 },
        },
        change: { property: 'fontSize', value: '20px', target: 'element' },
      },
    );
    expect(res.ok).toBe(false);
    expect(await read('src/Card.tsx')).toBe(CARD_TSX);
  });
});
