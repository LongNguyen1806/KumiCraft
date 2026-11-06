// Project breakpoints read by the Tailwind reader (K9 B, B4).
import { describe, expect, it } from 'vitest';

import { BREAKPOINT_WIDTHS } from '../responsive.ts';
import { parseClasses } from './parser.ts';
import { readValue } from './reader.ts';
import type { ClassContext } from './types.ts';

const defaultContext: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'mobile-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

describe('Tailwind reader with project breakpoints [WP-4.00, B4]', () => {
  it('B4: a project breakpoint in rem (--breakpoint-3xl: 120rem) applies from 1920px, not 120px [WP-4.00]', () => {
    const ctx: ClassContext = {
      ...defaultContext,
      theme: { ...defaultContext.theme, breakpoints: [{ name: '3xl', value: '120rem' }] },
    };
    const tokens = parseClasses('p-2 3xl:p-8', ctx);
    expect(readValue(tokens, 'padding', { width: 1440 }, ctx).value).toEqual({
      kind: 'scale',
      token: '2',
    });
    expect(readValue(tokens, 'padding', { width: 1920 }, ctx).value).toEqual({
      kind: 'scale',
      token: '8',
    });
  });
});
