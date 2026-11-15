// Per-screen writes (spec-log #141): an edit changes every frame unless one screen is chosen, and the
// classes read back exactly as asked on Mobile (375), Tablet (768) and Desktop (1440).
import { describe, expect, it } from 'vitest';

import { BREAKPOINT_WIDTHS } from '../responsive.ts';
import {
  differsByScreen,
  dropOneScreen,
  readScreenValues,
  writeAllScreens,
  writeOneScreen,
} from './screen-writer.ts';
import type { ClassContext, ClassValue } from './types.ts';

const theme = {
  colors: [{ name: 'brand', value: '#2563eb' }],
  fontSizes: [],
  radii: [],
  fonts: [],
  shadows: [],
  breakpoints: [],
};
const mobileFirst: ClassContext = { theme, mode: 'mobile-first', breakpoints: BREAKPOINT_WIDTHS };
const desktopFirst: ClassContext = { theme, mode: 'desktop-first', breakpoints: BREAKPOINT_WIDTHS };
const FRAMES = [1440, 375, 768]; // Desktop, Mobile, Tablet: the order the Canvas lists them
const DESKTOP = 0;
const MOBILE = 1;
const TABLET = 2;
const cols = (n: string): ClassValue => ({ kind: 'scale', token: n });
const brand: ClassValue = { kind: 'theme', name: 'brand' };

describe('per-screen writes [spec-log #141]', () => {
  it('an edit on any frame changes every frame when nothing differs by screen', () => {
    const div = 'w-[800px] grid grid-cols-3 gap-4';
    const out = writeAllScreens(div, 'backgroundColor', brand, mobileFirst);
    expect(out).toBe('w-[800px] grid grid-cols-3 gap-4 bg-brand');
    expect(readScreenValues(out, 'backgroundColor', FRAMES, mobileFirst)).toEqual([
      brand,
      brand,
      brand,
    ]);
  });

  it('only Mobile: Desktop keeps 3 columns, the code reads like hand-written mobile-first', () => {
    const out = writeOneScreen(
      'grid grid-cols-3',
      'gridCols',
      FRAMES,
      MOBILE,
      cols('1'),
      mobileFirst,
    );
    expect(out).toBe('grid grid-cols-1 md:grid-cols-3');
    expect(readScreenValues(out ?? '', 'gridCols', FRAMES, mobileFirst)).toEqual([
      cols('3'),
      cols('1'),
      cols('3'),
    ]);
  });

  it('only Mobile in a desktop-first project uses max-', () => {
    const out = writeOneScreen(
      'grid grid-cols-3',
      'gridCols',
      FRAMES,
      MOBILE,
      cols('1'),
      desktopFirst,
    );
    expect(out).toBe('grid grid-cols-3 max-md:grid-cols-1');
  });

  it('only Tablet leaves Mobile and Desktop as they were', () => {
    const out = writeOneScreen(
      'grid grid-cols-3',
      'gridCols',
      FRAMES,
      TABLET,
      cols('2'),
      mobileFirst,
    );
    expect(out).toBe('grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3');
    expect(readScreenValues(out ?? '', 'gridCols', FRAMES, mobileFirst)).toEqual([
      cols('3'),
      cols('3'),
      cols('2'),
    ]);
  });

  it('only Desktop on code that already differs by screen', () => {
    const out = writeOneScreen(
      'grid-cols-1 md:grid-cols-3',
      'gridCols',
      FRAMES,
      DESKTOP,
      cols('4'),
      mobileFirst,
    );
    expect(out).toBe('grid-cols-1 md:grid-cols-3 lg:grid-cols-4');
  });

  it('"all screens" collapses per-screen values, including old KumiCraft leftovers', () => {
    const leftover = 'bg-white xl:bg-brand absolute left-90';
    expect(differsByScreen(leftover, 'backgroundColor', FRAMES, mobileFirst)).toBe(true);
    expect(
      writeAllScreens(
        leftover,
        'backgroundColor',
        { kind: 'scale', token: 'amber-500' },
        mobileFirst,
      ),
    ).toBe('bg-amber-500 absolute left-90');
    expect(differsByScreen('bg-white p-4', 'backgroundColor', FRAMES, mobileFirst)).toBe(false);
  });

  it('never touches hover, focus or dark classes, and keeps a glass opacity', () => {
    const card = 'bg-white/60 hover:bg-sky-500 dark:bg-slate-900 md:bg-gray-50 backdrop-blur-md';
    expect(writeAllScreens(card, 'backgroundColor', brand, mobileFirst)).toBe(
      'bg-brand/60 hover:bg-sky-500 dark:bg-slate-900 backdrop-blur-md',
    );
  });

  it('dropping a frame value gives it back what the frame toward the base shows', () => {
    // Tablet 3 columns of its own: dropping it, Tablet goes back to Mobile's 1; Desktop stays 3.
    const out = dropOneScreen(
      'grid-cols-1 md:grid-cols-3',
      'gridCols',
      FRAMES,
      TABLET,
      mobileFirst,
    );
    expect(readScreenValues(out ?? '', 'gridCols', FRAMES, mobileFirst)).toEqual([
      cols('3'),
      cols('1'),
      cols('1'),
    ]);
    expect(out).toBe('grid-cols-1 lg:grid-cols-3');
  });

  it('keeps a side value right when the shorthand also differs by screen', () => {
    const input = 'p-4 md:px-2';
    const out = writeOneScreen(input, 'paddingLeft', FRAMES, MOBILE, cols('6'), mobileFirst);
    expect(out).toBeDefined();
    expect(readScreenValues(out ?? '', 'paddingLeft', FRAMES, mobileFirst)).toEqual([
      cols('2'),
      cols('6'),
      cols('2'),
    ]);
    // The other sides are untouched.
    expect(readScreenValues(out ?? '', 'paddingRight', FRAMES, mobileFirst)).toEqual(
      readScreenValues(input, 'paddingRight', FRAMES, mobileFirst),
    );
  });

  it('with only Mobile and Desktop frames, Mobile ends where phones end (md), not at xl', () => {
    const out = writeOneScreen('pr-4', 'paddingRight', [1440, 375], 1, cols('50'), desktopFirst);
    expect(out).toBe('pr-4 max-md:pr-50');
  });

  it('refuses rather than writing wrong code when two frames have no breakpoint between them', () => {
    expect(
      writeOneScreen('grid-cols-3', 'gridCols', [1300, 1440], 0, cols('2'), mobileFirst),
    ).toBeUndefined();
  });
});
