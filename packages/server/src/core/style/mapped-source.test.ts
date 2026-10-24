// Reading and writing a Sass project through the dev server's source map (R-ST-04, R-ST-06, R-ST-09).
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import type { BridgeStyleProbePayload, MatchedRule, StyleChange } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CompiledCssPort } from '../ports/compiled-css-port.ts';
import { createSourceEditorService } from '../source-editor/source-editor-service.ts';
import { nodeFs } from '../workspace/test-support.ts';
import { SASS_COMPILED, SASS_MAIN, SASS_PARTIAL } from './sass-compile.fixture.ts';
import { applyStyleChange } from './style-apply.ts';
import { createStyleService } from './style-service.ts';

describe('Sass through source maps [R-ST-04, R-ST-06]', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc-source-map-'));
    await fs.mkdir(path.join(root, 'src/styles'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/styles/main.scss'), SASS_MAIN);
    await fs.writeFile(path.join(root, 'src/styles/_card.scss'), SASS_PARTIAL);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  const read = (rel: string) => fs.readFile(path.join(root, rel), 'utf8');
  const sheetId = () => path.join(root, 'src/styles/main.scss').replaceAll('\\', '/');
  // The dev server's answer for main.scss: the real compile, its map naming `_card.scss`.
  const compiledCss: CompiledCssPort = {
    read: (id) => Promise.resolve(id === sheetId() ? SASS_COMPILED : undefined),
  };
  const rule = (ruleIndex: number, selector: string, over: Partial<MatchedRule> = {}) => ({
    sheet: { kind: 'module' as const, id: sheetId() },
    selector,
    media: [],
    occurrence: 0,
    ruleIndex,
    declarations: [],
    affects: 3,
    ...over,
  });
  const probe = (rules: MatchedRule[], computed: Record<string, string>) =>
    ({
      ref: { loc: 'src/Home.tsx:5:7', index: 0 },
      found: true,
      rules,
      inline: [],
      computed,
    }) satisfies BridgeStyleProbePayload;
  const apply = (rules: MatchedRule[], change: StyleChange) =>
    applyStyleChange(
      {
        fs: nodeFs,
        sourceEditor: createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' }),
        compiledCss,
      },
      root,
      { probe: probe(rules, {}), tag: 'h2', change },
    );

  it('shows the partial and line of a nested rule, and a mixin declaration as not editable', async () => {
    const title = rule(2, '.card .title', {
      declarations: [{ property: 'font-size', value: '18px', important: false }],
    });
    const card = rule(1, '.card', {
      declarations: [{ property: 'box-shadow', value: '0 1px 2px #0003', important: false }],
    });
    const reading = await createStyleService({ fs: nodeFs, compiledCss }).read(
      { root },
      probe([title, card], { 'font-size': '18px', 'box-shadow': '0 1px 2px #0003' }),
    );
    const byId = (id: string) => reading.properties.find((p) => p.id === id);
    expect(byId('fontSize')).toMatchObject({
      source: { kind: 'rule', file: 'src/styles/_card.scss', line: 12, system: 'sass' },
      editable: true,
    });
    expect(byId('boxShadow')).toMatchObject({ editable: false, reason: 'expression' });
  });

  it('"all N" edits the declaration in the partial, every other byte kept, main.scss untouched', async () => {
    const title = rule(2, '.card .title', {
      declarations: [{ property: 'font-size', value: '18px', important: false }],
    });
    const res = await apply([title], { property: 'fontSize', value: '20px', target: 'rule' });
    expect(res.ok && res.value.files.map((f) => f.path)).toEqual(['src/styles/_card.scss']);
    expect(await read('src/styles/_card.scss')).toBe(
      SASS_PARTIAL.replace('font-size: 18px;', 'font-size: 20px;'),
    );
    expect(await read('src/styles/main.scss')).toBe(SASS_MAIN);
  });

  it('edits inside the nested @media of the rule in the Mobile frame [R-ST-09]', async () => {
    const mobile = rule(3, '.card', {
      media: ['(max-width: 640px)'],
      declarations: [{ property: 'padding-top', value: '8px', important: false }],
    });
    const res = await apply([mobile], {
      property: 'paddingTop',
      value: '4px',
      target: 'rule',
      media: '(max-width: 640px)',
    });
    expect(res.ok).toBe(true);
    expect(await read('src/styles/_card.scss')).toBe(
      SASS_PARTIAL.replace('padding: 8px;', 'padding: 8px;\n    padding-top: 4px;'),
    );
  });

  it('refuses "all N" for a declaration a mixin brings in, and writes nothing', async () => {
    const card = rule(1, '.card', {
      declarations: [{ property: 'box-shadow', value: '0 1px 2px #0003', important: false }],
    });
    const res = await apply([card], { property: 'boxShadow', value: 'none', target: 'rule' });
    expect(res.ok ? undefined : res.error).toMatchObject({
      code: 'E016',
      params: { reason: 'expression' },
    });
    expect(await read('src/styles/_card.scss')).toBe(SASS_PARTIAL);
  });
});
