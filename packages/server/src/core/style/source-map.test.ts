// Source maps from a real Vite + Sass compile map rules back to their exact source line (R-ST-04).
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseStylesheet } from './css-locate.ts';
import { SASS_COMPILED as COMPILED, SASS_PARTIAL as PARTIAL } from './sass-compile.fixture.ts';
import { containerAt, mapCompiledRule } from './source-map.ts';

const SHEET = resolve('/proj/src/styles/main.scss');
const CARD = resolve('/proj/src/styles/_card.scss');

describe('source maps [R-ST-04]', () => {
  it('maps a nested Sass rule of a partial to the partial, rule and declaration line', () => {
    // Compiled rules: 0 `.base, .note`, 1 `.card`, 2 `.card .title`, 3 `@media .card`, 4 `.note`.
    expect(mapCompiledRule(COMPILED, SHEET, 2, 'font-size')).toEqual({
      rule: { file: CARD, line: 11, column: 3 },
      declaration: { file: CARD, line: 12, column: 5 },
    });
    expect(mapCompiledRule(COMPILED, SHEET, 0, 'border-top-left-radius')?.declaration?.line).toBe(
      6,
    );
  });

  it('finds the nested @media block, not its parent rule, as the block to edit [R-ST-09]', () => {
    const mapped = mapCompiledRule(COMPILED, SHEET, 3, 'padding-top');
    expect(mapped?.declaration).toEqual({ file: CARD, line: 15, column: 5 });
    const block = containerAt(
      parseStylesheet(PARTIAL, CARD),
      mapped?.declaration ?? mapped?.rule ?? { line: 0, column: 0 },
    );
    expect(block?.type).toBe('atrule');
    expect(block?.toString()).toContain('padding: 8px');
  });

  it('refuses a declaration a mixin brings in, since editing it changes every user [R-ST-04]', () => {
    const mapped = mapCompiledRule(COMPILED, SHEET, 1, 'box-shadow');
    expect(mapped?.declaration?.line).toBe(3);
    expect(
      containerAt(parseStylesheet(PARTIAL, CARD), mapped?.declaration ?? { line: 0, column: 0 }),
    ).toBeUndefined();
    // The rule's own declaration in the same compiled rule is still editable.
    const padding = mapCompiledRule(COMPILED, SHEET, 1, 'padding-top');
    expect(padding?.declaration?.line).toBe(9);
    expect(
      containerAt(parseStylesheet(PARTIAL, CARD), padding?.declaration ?? { line: 0, column: 0 })
        ?.type,
    ).toBe('rule');
  });

  it('gives undefined for CSS without a source map, so the caller falls back', () => {
    expect(mapCompiledRule('.a { color: red; }', SHEET, 0, 'color')).toBeUndefined();
  });
});
