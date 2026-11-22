// A shadow of the project's theme (`--shadow-card`), picked in the Effects group: the owner's hand
// test of 2026-11-15 got `shadow-card` written eight times, as it was read as a shadow color.
import { BREAKPOINT_WIDTHS } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { parseClasses } from './parser.ts';
import { readValue } from './reader.ts';
import type { ClassContext } from './types.ts';
import { writeValue } from './writer.ts';

const ctx: ClassContext = {
  theme: {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [{ name: 'card', value: '0 10px 30px -12px rgb(15 23 42 / 0.25)' }],
    breakpoints: [],
  },
  mode: 'mobile-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

const read = (cls: string) => readValue(parseClasses(cls, ctx), 'boxShadow', { width: 1440 }, ctx);

describe('theme shadow', () => {
  it('reads shadow-card as the box shadow, not a shadow color [R-IN-11]', () => {
    const [token] = parseClasses('shadow-card', ctx);
    expect(token?.property).toBe('boxShadow');
    expect(read('px-4 shadow-card').value).toBeDefined();
  });

  it('picking it again or picking another shadow replaces it, never adds a second one [R-IN-11]', () => {
    const card = parseClasses('shadow-card', ctx)[0]?.value;
    if (card === undefined) throw new Error('no value for shadow-card');
    const once = writeValue('px-4', 'boxShadow', { breakpoint: 'base' }, card, ctx);
    const twice = writeValue(once, 'boxShadow', { breakpoint: 'base' }, card, ctx);
    expect(twice).toBe('px-4 shadow-card');
    const md = writeValue(
      twice,
      'boxShadow',
      { breakpoint: 'base' },
      { kind: 'scale', token: 'md' },
      ctx,
    );
    expect(md).toBe('px-4 shadow-md');
  });
});
