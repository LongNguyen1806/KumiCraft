// Writing Inspector changes to CSS Modules (SPEC-04 M-ST, R-ST-06, R-ST-08, R-ST-09, R-ST-15).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  type BridgeStyleProbePayload,
  type MatchedRule,
  type StyleChange,
} from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSourceEditorService } from '../source-editor/source-editor-service.ts';
import { nodeFs } from '../workspace/test-support.ts';
import { applyStyleChange } from './style-apply.ts';

const MODULE_CSS = `.card {
  padding: 16px;
}
`;

const CARD_TSX = `import styles from './Card.module.css';

export function Card() {
  return (
    <article className={styles.card}>
      <h3>Title</h3>
    </article>
  );
}
`;

describe('applyStyleChange with CSS Modules [R-ST-06, R-ST-08, R-ST-09, R-ST-15]', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-apply-mods-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/Card.module.css'), MODULE_CSS);
    await fs.writeFile(path.join(root, 'src/Card.tsx'), CARD_TSX);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const read = (rel: string) => fs.readFile(path.join(root, rel), 'utf8');

  const cardRule = (over: Partial<MatchedRule> = {}): MatchedRule => ({
    sheet: { kind: 'module', id: path.join(root, 'src/Card.module.css').replaceAll('\\', '/') },
    selector: '._card_abc12_1',
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

  const deps = (id = 'ab10') => ({
    fs: nodeFs,
    sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
    newId: () => id,
  });

  const apply = (
    rules: MatchedRule[],
    change: StyleChange,
    loc = 'src/Card.tsx:5:5',
    newId = 'ab10',
  ) => applyStyleChange(deps(newId), root, { probe: probe(loc, rules), tag: 'article', change });

  it('"Tất cả": chỉ file .module.css đổi; files có một file, before là nội dung cũ [R-ST-06, R-ST-15]', async () => {
    const res = await apply([cardRule()], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.files).toHaveLength(1);
    expect(res.value.files[0]?.path).toBe('src/Card.module.css');
    expect(res.value.files[0]?.before).toBe(MODULE_CSS);
    const css = await read('src/Card.module.css');
    expect(css).toBe(`.card {\n  padding: 16px;\n  padding-top: 24px;\n}\n`);
    const jsx = await read('src/Card.tsx');
    expect(jsx).toBe(CARD_TSX);
  });

  it('"Tất cả" ở khung có media, rule thắng không có @media → rule .card mới trong khối @media [R-ST-09]', async () => {
    const res = await apply([cardRule()], {
      property: 'paddingTop',
      value: '8px',
      target: 'rule',
      media: '(max-width: 640px)',
    });
    expect(res.ok).toBe(true);
    const css = await read('src/Card.module.css');
    expect(css).toContain('@media (max-width: 640px) {\n  .card {\n    padding-top: 8px;\n  }\n}');
  });

  it('"Chỉ phần tử này" lần đầu: JSX thành template literal, rule .card_rcab10 cuối file module, className trả về, 2 file trong một kết quả [R-ST-08]', async () => {
    const res = await apply([cardRule()], {
      property: 'paddingTop',
      value: '32px',
      target: 'element',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.className).toBe('card_rcab10');
    expect(res.value.files).toHaveLength(2);
    const jsx = await read('src/Card.tsx');
    expect(jsx).toContain('className={`${styles.card} ${styles.card_rcab10}`}');
    const css = await read('src/Card.module.css');
    expect(css).toContain('.card_rcab10 {\n  padding-top: 32px;\n}');
  });

  it('Lần hai trên cùng phần tử (probe có rule của card_rcab10) → sửa rule đó, không thêm class, JSX không đổi [R-ST-08]', async () => {
    // First edit: generates card_rcab10
    const first = await apply([cardRule()], {
      property: 'paddingTop',
      value: '32px',
      target: 'element',
    });
    expect(first.ok).toBe(true);
    const jsxAfterFirst = await read('src/Card.tsx');

    // Second edit: probe now contains the card_rcab10 rule as index 1
    const ownRule: MatchedRule = {
      sheet: { kind: 'module', id: path.join(root, 'src/Card.module.css').replaceAll('\\', '/') },
      selector: '._card_rcab10_xyz',
      media: [],
      occurrence: 0,
      ruleIndex: 1,
      declarations: [{ property: 'padding-top', value: '32px', important: false }],
      affects: 1,
    };
    const second = await apply(
      [ownRule, cardRule()],
      { property: 'paddingTop', value: '40px', target: 'element' },
      'src/Card.tsx:5:5',
      'cd34',
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.files).toHaveLength(1);
    expect(second.value.files[0]?.path).toBe('src/Card.module.css');
    const jsxAfterSecond = await read('src/Card.tsx');
    expect(jsxAfterSecond).toBe(jsxAfterFirst);
    const css = await read('src/Card.module.css');
    expect(css).toContain('.card_rcab10 {\n  padding-top: 40px;\n}');
  });

  it('className={`${styles.a} ${styles.b}`} → nối thêm ${styles.<mới>} [R-ST-08]', async () => {
    const multiJsx = `import styles from './Card.module.css';

export function Card() {
  return (
    <article className={\`\${styles.a} \${styles.b}\`}>
      <h3>Title</h3>
    </article>
  );
}
`;
    await fs.writeFile(path.join(root, 'src/Card.tsx'), multiJsx);
    const res = await apply([], { property: 'textColor', value: 'red', target: 'element' });
    expect(res.ok).toBe(true);
    const jsx = await read('src/Card.tsx');
    expect(jsx).toContain('className={`${styles.a} ${styles.b} ${styles.a_rcab10}`}');
    const css = await read('src/Card.module.css');
    expect(css).toContain('.a_rcab10 {\n  color: red;\n}');
  });

  it('className={cn(styles.a, x)} → E016 expression, không file nào đổi [R-ST-08, L-01]', async () => {
    const cnJsx = `import styles from './Card.module.css';

export function Card() {
  return (
    <article className={cn(styles.a, x)}>
      <h3>Title</h3>
    </article>
  );
}
`;
    await fs.writeFile(path.join(root, 'src/Card.tsx'), cnJsx);
    const res = await apply([], { property: 'textColor', value: 'blue', target: 'element' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toEqual({ code: 'E016', params: { reason: 'expression' } });
    }
    const jsx = await read('src/Card.tsx');
    expect(jsx).toBe(cnJsx);
    const css = await read('src/Card.module.css');
    expect(css).toBe(MODULE_CSS);
  });

  it('JSX có CRLF và tab: phần còn lại của file giữ nguyên từng byte [R-ST-06]', async () => {
    const crlfJsx =
      'import styles from "./Card.module.css";\r\n\r\n\texport function Card() {\r\n\t\treturn <article className={styles.card}>Hello</article>;\r\n\t}\r\n';
    await fs.writeFile(path.join(root, 'src/Card.tsx'), crlfJsx);
    const res = await apply(
      [],
      { property: 'textColor', value: 'green', target: 'element' },
      'src/Card.tsx:4:10',
    );
    expect(res.ok).toBe(true);
    const jsx = await read('src/Card.tsx');
    expect(jsx).toBe(
      'import styles from "./Card.module.css";\r\n\r\n\texport function Card() {\r\n\t\treturn <article className={`${styles.card} ${styles.card_rcab10}`}>Hello</article>;\r\n\t}\r\n',
    );
  });

  it('a key that is not an identifier stays bracketed and the new key has no "-" [R-ST-08]', async () => {
    await fs.writeFile(path.join(root, 'src/Card.module.css'), '.card-title {\n  color: red;\n}\n');
    await fs.writeFile(
      path.join(root, 'src/Card.tsx'),
      CARD_TSX.replace('{styles.card}', "{styles['card-title']}"),
    );
    const res = await apply([], { property: 'textColor', value: 'blue', target: 'element' });

    expect(res.ok && res.value.className).toBe('card_title_rcab10');
    expect(await read('src/Card.tsx')).toContain(
      "className={`${styles['card-title']} ${styles.card_title_rcab10}`}",
    );
  });

  it('a plain string className in a file that uses modules takes the plain CSS path [R-ST-06]', async () => {
    await fs.writeFile(
      path.join(root, 'src/Card.tsx'),
      CARD_TSX.replace('{styles.card}', '"plain"'),
    );
    const res = await apply([], { property: 'textColor', value: 'blue', target: 'element' });

    expect(res.ok && res.value.className).toBe('plain-ab10');
    expect(await read('src/Card.module.css')).toBe(MODULE_CSS);
    expect(await read('src/Card.css')).toBe('.plain-ab10 {\n  color: blue;\n}\n');
  });

  it('on a smaller frame changes the own class copy inside that @media instead of adding another [R-ST-09]', async () => {
    const css = `${MODULE_CSS}\n.card_rcab10 {\n  color: red;\n}\n\n@media (max-width: 640px) {\n  .card_rcab10 {\n    color: green;\n  }\n}\n`;
    await fs.writeFile(path.join(root, 'src/Card.module.css'), css);
    await fs.writeFile(
      path.join(root, 'src/Card.tsx'),
      CARD_TSX.replace('{styles.card}', '{`${styles.card} ${styles.card_rcab10}`}'),
    );
    const own = (ruleIndex: number, media: string[]) =>
      cardRule({ selector: '._card_rcab10_x', ruleIndex, media });
    await apply([own(2, ['(max-width: 640px)']), own(1, []), cardRule()], {
      property: 'textColor',
      value: 'blue',
      target: 'element',
      media: '(max-width: 640px)',
    });

    expect(await read('src/Card.module.css')).toBe(css.replace('color: green;', 'color: blue;'));
  });

  it('"all" with no rule of the project falls back to a class of its own, like plain CSS', async () => {
    const res = await apply([], { property: 'textColor', value: 'red', target: 'rule' });

    expect(res.ok && res.value.className).toBe('card_rcab10');
  });

  it('counts rules the way the browser does: @keyframes steps are not rules [R-ST-04]', async () => {
    const css = `@keyframes spin {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}\n\n${MODULE_CSS}`;
    await fs.writeFile(path.join(root, 'src/Card.module.css'), css);
    await apply([cardRule({ ruleIndex: 0 })], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
    });

    expect(await read('src/Card.module.css')).toBe(
      css.replace('padding: 16px;', 'padding: 16px;\n  padding-top: 24px;'),
    );
  });

  it('appends .card:hover at the end of .module.css when target is rule and state is hover [R-ST-08, R-ST-09]', async () => {
    const res = await apply([cardRule()], {
      property: 'paddingTop',
      value: '24px',
      target: 'rule',
      state: 'hover',
    });

    expect(res.ok && res.value.files.map((f) => f.path)).toEqual(['src/Card.module.css']);
    expect(await read('src/Card.module.css')).toBe(
      `${MODULE_CSS}\n.card:hover {\n  padding-top: 24px;\n}\n`,
    );
  });
});
