// K9.5: a property no rule sets yet goes into the element's own single-class rule (BEM, like
// MarketLink's `.forbidden-page__code`) instead of a new class in the JSX.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { BridgeStyleProbePayload, MatchedRule, StyleChange } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSourceEditorService } from '../source-editor/source-editor-service.ts';
import { nodeFs } from '../workspace/test-support.ts';
import { applyStyleChange } from './style-apply.ts';

const CSS = `.page__code {
  color: gray;
}

.page__desc {
  color: black;
}
`;
const TSX = `import './Page.css';

export function Page() {
  return (
    <div>
      <p className="page__code">403</p>
    </div>
  );
}
`;

describe('style change into the element own class rule [WP-4.00, K9.5]', () => {
  let root: string;
  let ids = 0;

  beforeEach(async () => {
    ids = 0;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-sole-class-'));
    await fs.mkdir(path.join(root, 'src'));
    await fs.writeFile(path.join(root, 'src/Page.css'), CSS);
    await fs.writeFile(path.join(root, 'src/Page.tsx'), TSX);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const read = (rel: string) => fs.readFile(path.join(root, rel), 'utf8');
  const rule = (over: Partial<MatchedRule> = {}): MatchedRule => ({
    sheet: { kind: 'module', id: path.join(root, 'src/Page.css').replaceAll('\\', '/') },
    selector: '.page__code',
    media: [],
    occurrence: 0,
    ruleIndex: 0,
    declarations: [],
    affects: 1,
    ...over,
  });
  const probe = (rules: MatchedRule[]): BridgeStyleProbePayload => ({
    ref: { loc: 'src/Page.tsx:6:7', index: 0 },
    found: true,
    rules,
    inline: [],
    computed: {},
  });
  const apply = (rules: MatchedRule[], change: StyleChange) =>
    applyStyleChange(
      {
        fs: nodeFs,
        sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
        newId: () => `ab1${String(ids++)}`,
      },
      root,
      { probe: probe(rules), tag: 'p', change },
    );
  const padding: StyleChange = { property: 'paddingTop', value: '13px', target: 'element' };

  it('a class only this element has gets the declaration; the JSX stays as it was [WP-4.00]', async () => {
    const res = await apply([rule()], padding);
    expect(res.ok && res.value.files.map((f) => [f.path, f.before])).toEqual([
      ['src/Page.css', CSS],
    ]);
    expect(res.ok && res.value.className).toBeUndefined();
    expect(await read('src/Page.css')).toBe(
      CSS.replace('  color: gray;\n}', '  color: gray;\n  padding-top: 13px;\n}'),
    );
    expect(await read('src/Page.tsx')).toBe(TSX);
  });

  it('a hover change goes to the same class with :hover, still no new class [WP-4.00]', async () => {
    const res = await apply([rule()], { ...padding, state: 'hover' });
    expect(res.ok && res.value.files.map((f) => f.path)).toEqual(['src/Page.css']);
    expect(await read('src/Page.css')).toContain('.page__code:hover {\n  padding-top: 13px;\n}');
    expect(await read('src/Page.tsx')).toBe(TSX);
  });

  it('a class shared by several elements still gets a class of its own for this element [WP-4.00]', async () => {
    const res = await apply([rule({ affects: 2 })], padding);
    expect(res.ok && res.value.className).toBe('page__code-ab10');
    expect(await read('src/Page.tsx')).toContain('className="page__code page__code-ab10"');
  });

  it('a descendant or listed selector is not the element own class [WP-4.00]', async () => {
    for (const selector of ['div .page__code', '.page__code, .other', '.page__code:first-child']) {
      await fs.writeFile(path.join(root, 'src/Page.css'), CSS);
      await fs.writeFile(path.join(root, 'src/Page.tsx'), TSX);
      const res = await apply([rule({ selector })], padding);
      expect(res.ok && res.value.className, selector).toMatch(/^page__code-ab1\d$/);
    }
  });

  it('a rule that already sets the property is changed where it is, as before [WP-4.00]', async () => {
    const declared = rule({
      affects: 1,
      declarations: [{ property: 'padding-top', value: '4px', important: false }],
    });
    await fs.writeFile(
      path.join(root, 'src/Page.css'),
      CSS.replace('color: gray;', 'color: gray;\n  padding-top: 4px;'),
    );
    const res = await apply([declared], { ...padding, target: 'rule' });
    expect(res.ok && res.value.files.map((f) => f.path)).toEqual(['src/Page.css']);
    expect(await read('src/Page.css')).toContain('padding-top: 13px;');
    expect(await read('src/Page.css')).not.toContain('4px');
  });
});
