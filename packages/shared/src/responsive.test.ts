// SPEC-03 section 2: the band rule kept from 0.18 (same expectations as its tests).
import { describe, expect, it } from 'vitest';

import { bandOf, editBreakpoint } from './responsive.ts';

describe('bandOf', () => {
  it('desktop-first: the smallest key whose breakpoint is above the width, or base from 1536', () => {
    const widths = [1920, 1536, 1440, 1280, 1024, 800, 768, 640, 375];

    const bands = widths.map((w) => bandOf(w, 'desktop-first'));

    expect(bands).toEqual(['base', 'base', '2xl', '2xl', 'xl', 'lg', 'lg', 'md', 'sm']);
  });

  it('mobile-first: the largest key at or below the width, or base under 640', () => {
    const widths = [375, 639, 640, 768, 1023, 1024, 1440, 1536, 1920];

    const bands = widths.map((w) => bandOf(w, 'mobile-first'));

    expect(bands).toEqual(['base', 'base', 'sm', 'md', 'md', 'lg', 'xl', '2xl', '2xl']);
  });

  it('uses the breakpoints of the project when it defines its own', () => {
    const custom = { sm: 600, md: 900, lg: 1200, xl: 1400, '2xl': 1800 };

    expect(bandOf(1000, 'desktop-first', custom)).toBe('lg');
    expect(bandOf(1000, 'mobile-first', custom)).toBe('md');
  });
});

describe('editBreakpoint', () => {
  it('desktop-first with the 1440 primary frame: the spec example table', () => {
    const frames = [1440, 1280, 768, 375];

    const keys = frames.map((w) => editBreakpoint(w, 1440, 'desktop-first'));

    expect(keys).toEqual(['base', 'base', 'lg', 'sm']);
  });

  it('mobile-first with the 375 primary frame', () => {
    const frames = [375, 768, 1440];

    const keys = frames.map((w) => editBreakpoint(w, 375, 'mobile-first'));

    expect(keys).toEqual(['base', 'md', 'xl']);
  });
});
