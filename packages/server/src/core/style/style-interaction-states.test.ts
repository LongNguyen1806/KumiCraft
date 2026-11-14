// Tests for K9.8-1 Group 3: all 7 style systems read & write active, groupHover, selected, dark, and dark+hover.
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  type BridgeStyleProbePayload,
  type StylingReport,
  type StylingSystemId,
  type ThemeInfo,
} from '@kumicraft/shared';
import { type ClassContext, parseClasses, readValue, writeValue } from '@kumicraft/shared/tailwind';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSourceEditorService } from '../source-editor/source-editor-service.ts';
import { nodeFs } from '../workspace/test-support.ts';
import { withModifiersSelector } from './css-edit.ts';
import { applyStyleChange } from './style-apply.ts';
import { createStyleService } from './style-service.ts';

const EMPTY_THEME: ThemeInfo = {
  colors: [],
  fontSizes: [],
  radii: [],
  fonts: [],
  shadows: [],
  breakpoints: [],
};

function makeTwCtx(major: 3 | 4): ClassContext {
  return {
    theme: EMPTY_THEME,
    mode: 'mobile-first',
    major,
    breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
  };
}

const CSS_BASED_SYSTEMS: readonly { readonly id: StylingSystemId; readonly ext: string }[] = [
  { id: 'bootstrap', ext: 'css' },
  { id: 'cssModules', ext: 'module.css' },
  { id: 'css', ext: 'css' },
  { id: 'sass', ext: 'scss' },
  { id: 'less', ext: 'less' },
];

describe('Interaction states & dark mode across all 7 style systems (K9.8-1 Group 3)', () => {
  let root = '';
  let sourceEditor: ReturnType<typeof createSourceEditorService>;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'kc-styles-7-'));
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    sourceEditor = createSourceEditorService({ fs: nodeFs }, { sourceDir: 'src' });
  });

  afterEach(async () => {
    if (root.length > 0) await fs.rm(root, { recursive: true, force: true });
  });

  it.each([4, 3] as const)(
    'tailwind%d reads and writes active, groupHover, selected, dark, and dark+hover',
    (major) => {
      const ctx = makeTwCtx(major);
      let cls = '';
      cls = writeValue(
        cls,
        'backgroundColor',
        { breakpoint: 'base', state: 'active' },
        { kind: 'arbitrary', css: '#111111' },
        ctx,
      );
      cls = writeValue(
        cls,
        'textColor',
        { breakpoint: 'base', state: 'groupHover' },
        { kind: 'arbitrary', css: '#222222' },
        ctx,
      );
      cls = writeValue(
        cls,
        'borderColor',
        { breakpoint: 'base', state: 'selected' },
        { kind: 'arbitrary', css: '#333333' },
        ctx,
      );
      cls = writeValue(
        cls,
        'backgroundColor',
        { breakpoint: 'base', dark: true },
        { kind: 'arbitrary', css: '#0f172a' },
        ctx,
      );
      cls = writeValue(
        cls,
        'backgroundColor',
        { breakpoint: 'base', dark: true, state: 'hover' },
        { kind: 'arbitrary', css: '#1e293b' },
        ctx,
      );

      expect(cls).toContain('active:bg-[#111111]');
      expect(cls).toContain('group-hover:text-[#222222]');
      expect(cls).toContain('data-[selected=true]:border-[#333333]');
      expect(cls).toContain('dark:bg-[#0f172a]');
      expect(cls).toContain('dark:hover:bg-[#1e293b]');

      const tokens = parseClasses(cls, ctx);
      expect(
        readValue(tokens, 'backgroundColor', { width: 1440, state: 'active' }, ctx).value,
      ).toEqual({
        kind: 'arbitrary',
        css: '#111111',
      });
      expect(
        readValue(tokens, 'textColor', { width: 1440, state: 'groupHover' }, ctx).value,
      ).toEqual({
        kind: 'arbitrary',
        css: '#222222',
      });
      expect(
        readValue(tokens, 'borderColor', { width: 1440, state: 'selected' }, ctx).value,
      ).toEqual({
        kind: 'arbitrary',
        css: '#333333',
      });
      expect(readValue(tokens, 'backgroundColor', { width: 1440, dark: true }, ctx).value).toEqual({
        kind: 'arbitrary',
        css: '#0f172a',
      });
      expect(
        readValue(tokens, 'backgroundColor', { width: 1440, dark: true, state: 'hover' }, ctx)
          .value,
      ).toEqual({
        kind: 'arbitrary',
        css: '#1e293b',
      });
    },
  );

  it.each(CSS_BASED_SYSTEMS)(
    '$id writes and reads active, groupHover, selected, dark, and dark+hover CSS rules cleanly',
    async ({ id, ext }) => {
      const styleRel = `src/card.${ext}`;
      const styleAbs = path.join(root, styleRel).replaceAll('\\', '/');
      const jsxRel = 'src/Card.tsx';
      const isModules = id === 'cssModules';
      const jsxCode = isModules
        ? `import styles from './card.${ext}';\nexport function Card() {\n  return <div className={styles.box}>Card</div>;\n}\n`
        : `import './card.${ext}';\nexport function Card() {\n  return <div className="box">Card</div>;\n}\n`;
      await fs.writeFile(path.join(root, jsxRel), jsxCode, 'utf8');
      await fs.writeFile(path.join(root, styleRel), '.box { color: #111111; }\n', 'utf8');

      const styling: StylingReport = {
        systems: [{ id }],
        primary: isModules ? 'cssModules' : 'css',
        editable: true,
        globalCss: isModules ? [] : [styleRel],
      };

      const cases = [
        {
          state: 'active' as const,
          dark: false,
          prop: 'backgroundColor',
          cssProp: 'background-color',
          val: '#112233',
        },
        {
          state: 'groupHover' as const,
          dark: false,
          prop: 'textColor',
          cssProp: 'color',
          val: '#223344',
        },
        {
          state: 'selected' as const,
          dark: false,
          prop: 'fontSize',
          cssProp: 'font-size',
          val: '18px',
        },
        {
          state: undefined,
          dark: true,
          prop: 'backgroundColor',
          cssProp: 'background-color',
          val: '#0f172a',
        },
        {
          state: 'hover' as const,
          dark: true,
          prop: 'backgroundColor',
          cssProp: 'background-color',
          val: '#1e293b',
        },
      ];

      const styleService = createStyleService({ fs: nodeFs });
      for (const c of cases) {
        const expectedSel = withModifiersSelector('.box', {
          state: c.state,
          dark: c.dark,
          cssModules: isModules,
        });
        const probe: BridgeStyleProbePayload = {
          ref: { loc: `${jsxRel}:3:10`, index: 0 },
          found: true,
          rules: [
            {
              selector: '.box',
              sheet: { kind: 'module', id: styleAbs },
              media: [],
              occurrence: 0,
              ruleIndex: 0,
              declarations: [{ property: 'color', value: '#111111', important: false }],
              affects: 1,
            },
          ],
          inline: [],
          computed: {
            'background-color': 'rgb(255, 255, 255)',
            color: '#111111',
            'border-color': '#000',
          },
        };

        const applied = await applyStyleChange({ fs: nodeFs, sourceEditor, styling }, root, {
          probe,
          tag: 'div',
          change: {
            property: c.prop,
            target: 'rule',
            value: c.val,
            ...(c.state !== undefined ? { state: c.state } : {}),
            ...(c.dark ? { dark: true } : {}),
          },
        });
        expect(applied.ok).toBe(true);

        const cssText = await fs.readFile(path.join(root, styleRel), 'utf8');
        if (isModules) {
          const escaped = expectedSel
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace('\\.box', '\\.box(?:_[a-z0-9]+)?');
          expect(cssText).toMatch(new RegExp(escaped));
        } else {
          expect(cssText).toContain(expectedSel);
        }
        expect(cssText).toContain(`${c.cssProp}: ${c.val}`);

        const addedSelectorMatch = isModules
          ? cssText.match(new RegExp(`([^{}]+)\\{[^}]*${c.cssProp}:\\s*${c.val}`))?.[1]?.trim()
          : expectedSel;
        const actualSelector = addedSelectorMatch ?? expectedSel;

        // Read back with matching rule winning first in probe
        const readProbe: BridgeStyleProbePayload = {
          ...probe,
          rules: [
            {
              selector: actualSelector,
              sheet: { kind: 'module', id: styleAbs },
              media: [],
              occurrence: 0,
              ruleIndex: 1,
              declarations: [{ property: c.cssProp, value: c.val, important: false }],
              affects: 1,
            },
            ...probe.rules,
          ],
          computed: {
            ...probe.computed,
            [c.cssProp]: c.val,
          },
        };
        const reading = await styleService.read({ root, styling }, readProbe);
        const foundProp = reading.properties.find((p) => p.id === c.prop);
        expect(foundProp?.value?.css).toBe(c.val);
        expect(foundProp?.source?.kind).toBe('rule');
      }
    },
  );
});
