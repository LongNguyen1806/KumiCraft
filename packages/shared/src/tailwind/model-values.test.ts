// Unit tests for M-TW variants, arbitrary values and px conversion (SPEC-04 section 8).
import { describe, expect, it } from 'vitest';

import { BREAKPOINT_WIDTHS } from '../responsive.ts';
import { parseClasses } from './parser.ts';
import { pxToSpacing } from './properties.ts';
import type { ClassContext } from './types.ts';
import { writeValue } from './writer.ts';

const desktopContext: ClassContext = {
  theme: {
    colors: [{ name: 'brand', value: '#123456' }],
    fontSizes: [{ name: 'hero', value: '4rem' }],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [{ name: '3xl', value: '1920' }],
  },
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

describe('M-TW variants, arbitrary values and px', () => {
  it('keeps variants it does not know as tokens without property [R-TW-03]', () => {
    const tokens = parseClasses(
      'dark:bg-black group-hover:p-2 aria-checked:p-1 [&>*]:p-2 md:p-4 max-sm:p-1 hover:p-2 focus:p-3 disabled:p-1 lg:hover:p-6 foo-bar',
      desktopContext,
    );
    const mapped = tokens.map((t) => [t.raw, t.property]);
    expect(mapped).toEqual([
      ['dark:bg-black', 'backgroundColor'],
      ['group-hover:p-2', 'padding'],
      ['aria-checked:p-1', undefined],
      ['[&>*]:p-2', undefined],
      ['md:p-4', 'padding'],
      ['max-sm:p-1', 'padding'],
      ['hover:p-2', 'padding'],
      ['focus:p-3', 'padding'],
      ['disabled:p-1', 'padding'],
      ['lg:hover:p-6', 'padding'],
      ['foo-bar', undefined],
    ]);
  });

  it('reads and writes arbitrary values with spaces as underscores [R-TW-10]', () => {
    const tokens = parseClasses('w-[calc(100%_-_2rem)]', desktopContext);
    expect(tokens[0]).toMatchObject({
      property: 'width',
      value: { kind: 'arbitrary', css: 'calc(100% - 2rem)' },
    });
    const written = writeValue(
      'flex',
      'width',
      { breakpoint: 'base' },
      { kind: 'arbitrary', css: 'calc(100% - 2rem)' },
      desktopContext,
    );
    expect(written).toBe('flex w-[calc(100%_-_2rem)]');
  });

  it('converts px to the spacing scale or an arbitrary value [R-TW-08]', () => {
    expect(pxToSpacing(40)).toEqual({ kind: 'scale', token: '10' });
    expect(pxToSpacing(13)).toEqual({ kind: 'arbitrary', css: '13px' });
    expect(pxToSpacing(0)).toEqual({ kind: 'scale', token: '0' });
    expect(pxToSpacing(1)).toEqual({ kind: 'scale', token: 'px' });
    expect(pxToSpacing(6)).toEqual({ kind: 'scale', token: '1.5' });
    expect(pxToSpacing(16, 8)).toEqual({ kind: 'scale', token: '2' });
  });
});
