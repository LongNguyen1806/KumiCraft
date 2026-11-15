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

  it('keeps the opacity of a replaced color so a glass surface stays see-through [spec-log #140]', () => {
    const glass = 'p-6 bg-white/60 backdrop-blur-md border border-gray-200/40';
    const base = { breakpoint: 'base' } as const;
    // Theme and palette colors keep the /60; the blur stays.
    expect(
      writeValue(glass, 'backgroundColor', base, { kind: 'theme', name: 'brand' }, desktopContext),
    ).toBe('p-6 bg-brand/60 backdrop-blur-md border border-gray-200/40');
    expect(
      writeValue(glass, 'borderColor', base, { kind: 'scale', token: 'sky-300' }, desktopContext),
    ).toBe('p-6 bg-white/60 backdrop-blur-md border border-sky-300/40');
    // Older glass blocks carry a solid and a see-through color: they merge into one translucent.
    expect(
      writeValue(
        'bg-white bg-white/60 backdrop-blur-md',
        'backgroundColor',
        base,
        { kind: 'theme', name: 'brand' },
        desktopContext,
      ),
    ).toBe('bg-brand/60 backdrop-blur-md');
    // A plain hex keeps it too; colors without alpha and solid colors stay as picked.
    expect(
      writeValue(
        glass,
        'backgroundColor',
        base,
        { kind: 'arbitrary', css: '#ff0000' },
        desktopContext,
      ),
    ).toContain('bg-[#ff0000]/60');
    expect(
      writeValue(
        glass,
        'backgroundColor',
        base,
        { kind: 'scale', token: 'transparent' },
        desktopContext,
      ),
    ).toContain(' bg-transparent ');
    expect(
      writeValue(
        'bg-white p-6',
        'backgroundColor',
        base,
        { kind: 'theme', name: 'brand' },
        desktopContext,
      ),
    ).toBe('bg-brand p-6');
  });
});
