// Exhaustive validation of all blocks x all variants x 7 style systems (Test 9, TK-43, TK-47).
import { LIBRARY_BLOCKS, lookFromTheme, renderBlock, STYLE_SYSTEM_IDS } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { parseJsxAst } from '../../../../lib/ast-helpers.ts';
import { validateInsertedCss } from './insert-css.ts';
import { validateInsertedJsx } from './structure-ops.ts';

const SAMPLE_LOOK = lookFromTheme({
  colors: [
    { name: 'primary', value: '#4f46e5', variable: '--primary' },
    { name: 'primary-foreground', value: '#ffffff', variable: '--primary-foreground' },
    { name: 'background', value: '#ffffff', variable: '--background' },
    { name: 'muted', value: '#f4f4f5', variable: '--muted' },
    { name: 'foreground', value: '#09090b', variable: '--foreground' },
    { name: 'muted-foreground', value: '#71717a', variable: '--muted-foreground' },
    { name: 'border', value: '#e4e4e7', variable: '--border' },
  ],
  radii: [{ name: 'radius', value: '8px', variable: '--radius' }],
  fonts: [{ name: 'heading', value: 'Inter, sans-serif', variable: '--font-heading' }],
  fontSizes: [],
  shadows: [],
  breakpoints: [],
});

describe('library-render-all: every block x every variant x 7 style systems', () => {
  it('9. leaves no {role} placeholders, no @keys, valid JSX AST, and valid CSS rules across all combinations', () => {
    const looks = [undefined, SAMPLE_LOOK] as const;

    for (const block of LIBRARY_BLOCKS) {
      const variantIds = [undefined, ...(block.variants?.map((v) => v.id) ?? [])];
      for (const variantId of variantIds) {
        for (const system of STYLE_SYSTEM_IDS) {
          for (const lang of ['vi', 'en'] as const) {
            for (const look of looks) {
              const ctx = `${block.id}:${String(variantId)}:${system}:${lang}`;
              const rendered = renderBlock(block, system, lang, look, variantId);

              expect(rendered.jsx, `${ctx} left {role} in JSX`).not.toMatch(/\{[a-zA-Z0-9_-]+\}/);
              expect(rendered.jsx, `${ctx} left @key in JSX`).not.toMatch(/className="@/);

              expect(
                () => parseJsxAst(`const _Preview = () => (\n${rendered.jsx}\n);`),
                `${ctx} invalid JSX AST`,
              ).not.toThrow();

              const jsxValidation = validateInsertedJsx(rendered.jsx);
              expect(jsxValidation.ok, `${ctx} failed validateInsertedJsx`).toBe(true);

              for (const rule of rendered.rules) {
                for (const [prop, val] of Object.entries(rule.declarations)) {
                  expect(val, `${ctx} ${rule.selector}.${prop} left {role}`).not.toMatch(
                    /\{[a-zA-Z0-9_-]+\}/,
                  );
                }
              }

              const cssValidation = validateInsertedCss(rendered.rules);
              expect(cssValidation.ok, `${ctx} failed validateInsertedCss`).toBe(true);
            }
          }
        }
      }
    }
  });
});
