// Which screens an Inspector edit reaches (spec-log #141): every screen by default, a question when
// the property already differs by screen, "only this screen" on request, hover always everywhere.
import { BREAKPOINT_WIDTHS } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import {
  hasOwnScreenValue,
  scopeClassChange,
  sharedValueOfOthers,
  writeEntries,
} from './screen-scope.ts';
import { readScreenValues } from './screen-writer.ts';
import type { ClassContext, ClassValue } from './types.ts';

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

  describe('Canvas changes (drag, resize, nudge, align, X/Y/W/H) [spec-log #144]', () => {
    const read = (cls: string, w: number) => readScreenValues(cls, 'width', [w], ctx)[0];

    it('"edit for Mobile only": resizing on Mobile leaves Desktop and Tablet as they were', () => {
      const out = scopeClassChange('flex w-[808px]', 'flex w-[300px]', ctx, onMobile, true);
      expect(out).toBeDefined();
      expect(read(out ?? '', 375)).toEqual({ kind: 'arbitrary', css: '300px' });
      expect(read(out ?? '', 768)).toEqual({ kind: 'arbitrary', css: '808px' });
      expect(read(out ?? '', 1440)).toEqual({ kind: 'arbitrary', css: '808px' });
    });

    it('outside a session a resize reaches every screen, exactly as the Canvas wrote it', () => {
      expect(scopeClassChange('flex w-[808px]', 'flex w-[300px]', ctx, onMobile, false)).toBe(
        'flex w-[300px]',
      );
    });

    it('outside a session, a width Mobile already has of its own is the one resized there', () => {
      const own = 'flex w-[300px] md:w-[808px]';
      const out = scopeClassChange(own, 'flex w-[250px] md:w-[808px]', ctx, onMobile, false);
      expect(read(out ?? '', 375)).toEqual({ kind: 'arbitrary', css: '250px' });
      expect(read(out ?? '', 1440)).toEqual({ kind: 'arbitrary', css: '808px' });
    });

    it('a drag in a session moves only that screen', () => {
      const out = scopeClassChange(
        'absolute left-56 top-34',
        'absolute left-4 top-10',
        ctx,
        onMobile,
        true,
      );
      expect(readScreenValues(out ?? '', 'left', widths, ctx)).toEqual([
        { kind: 'scale', token: '56' },
        { kind: 'scale', token: '4' },
        { kind: 'scale', token: '56' },
      ]);
    });

    it('refuses a change it cannot keep for one screen instead of writing it everywhere', () => {
      expect(scopeClassChange('w-[808px]', 'w-[300px] js-card-hook', ctx, onMobile, true)).toBe(
        undefined,
      );
    });
  });
});
