// Which screens an Inspector edit reaches (spec-log #141): every screen by default, a question when
// the property already differs by screen, "only this screen" on request, hover always everywhere.
import { BREAKPOINT_WIDTHS, type ClassContext, type ClassValue } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { hasOwnScreenValue, sharedValueOfOthers, writeEntries } from './screen-scope.ts';

const ctx: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'mobile-first',
  breakpoints: BREAKPOINT_WIDTHS,
};
// Desktop, Mobile, Tablet: the frames of the owner's test project.
const widths = [1440, 375, 768];
const onDesktop = { widths, activeIndex: 0 };
const onMobile = { widths, activeIndex: 1 };
const onTablet = { widths, activeIndex: 2 };
const base = { breakpoint: 'base' } as const;
const cols = (n: string): ClassValue => ({ kind: 'scale', token: n });

describe('screen scope of Inspector edits [spec-log #141]', () => {
  it('an edit on Tablet reaches every screen when nothing differs by screen', () => {
    const out = writeEntries(
      'grid grid-cols-3',
      [{ property: 'gridCols', value: cols('4') }],
      base,
      ctx,
      onTablet,
      'auto',
    );
    expect(out).toEqual({ kind: 'write', next: 'grid grid-cols-4' });
  });

  it('asks before touching a property that differs by screen, then does what was answered', () => {
    const responsive = 'grid grid-cols-1 md:grid-cols-3';
    const entry = [{ property: 'gridCols' as const, value: cols('4') }];
    expect(writeEntries(responsive, entry, base, ctx, onDesktop, 'auto')).toEqual({ kind: 'ask' });
    expect(writeEntries(responsive, entry, base, ctx, onDesktop, 'all')).toEqual({
      kind: 'write',
      next: 'grid grid-cols-4',
    });
    expect(writeEntries(responsive, entry, base, ctx, onDesktop, 'only')).toEqual({
      kind: 'write',
      next: 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4',
    });
  });

  it('"only Mobile" gives Mobile one column and keeps three elsewhere', () => {
    const out = writeEntries(
      'grid grid-cols-3',
      [{ property: 'gridCols', value: cols('1') }],
      base,
      ctx,
      onMobile,
      'only',
    );
    expect(out).toEqual({ kind: 'write', next: 'grid grid-cols-1 md:grid-cols-3' });
  });

  it('a hover edit reaches every screen and never asks', () => {
    const hover = { breakpoint: 'base', state: 'hover' } as const;
    const out = writeEntries(
      'bg-white md:bg-gray-50',
      [{ property: 'backgroundColor', value: { kind: 'scale', token: 'sky-500' } }],
      hover,
      ctx,
      onTablet,
      'auto',
    );
    expect(out).toEqual({ kind: 'write', next: 'bg-white md:bg-gray-50 hover:bg-sky-500' });
  });

  it('marks only the screen whose value the others do not share', () => {
    const responsive = 'grid-cols-1 md:grid-cols-3';
    expect(hasOwnScreenValue(responsive, 'gridCols', onMobile, ctx)).toBe(true);
    expect(hasOwnScreenValue(responsive, 'gridCols', onTablet, ctx)).toBe(false);
    expect(hasOwnScreenValue(responsive, 'gridCols', onDesktop, ctx)).toBe(false);
    // Dropping Mobile's own value gives it what the other screens share.
    expect(sharedValueOfOthers(responsive, 'gridCols', onMobile, ctx)).toEqual({
      value: cols('3'),
    });
    expect(hasOwnScreenValue('grid-cols-3', 'gridCols', onMobile, ctx)).toBe(false);
  });
});
