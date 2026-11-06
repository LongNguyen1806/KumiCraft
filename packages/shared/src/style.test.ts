import { describe, expect, it } from 'vitest';

import { mediaForBreakpoint, unpackBorderRadius, unpackBorderWidth } from './style.ts';

describe('mediaForBreakpoint [R-ST-09]', () => {
  it('uses the same bands as Tailwind variants, and no @media on the base breakpoint', () => {
    expect(mediaForBreakpoint('base', 'desktop-first')).toBeUndefined();
    expect(mediaForBreakpoint('sm', 'desktop-first')).toBe('(max-width: 639px)');
    expect(mediaForBreakpoint('md', 'mobile-first')).toBe('(min-width: 768px)');
  });

  it('supports custom project breakpoints [WP-4.00]', () => {
    const custom = [
      { key: 'sm', min: 640 },
      { key: 'md', min: 768 },
      { key: '3xl', min: 1920 },
    ];
    expect(mediaForBreakpoint('3xl', 'desktop-first', custom)).toBe('(max-width: 1919px)');
    expect(mediaForBreakpoint('3xl', 'mobile-first', custom)).toBe('(min-width: 1920px)');
  });
});

describe('unpackBorderRadius & unpackBorderWidth [WP-4.00]', () => {
  it('unpacks border-radius shorthand into tl, tr, br, bl', () => {
    expect(unpackBorderRadius('4px 8px')).toEqual({
      borderTopLeftRadius: '4px',
      borderTopRightRadius: '8px',
      borderBottomRightRadius: '4px',
      borderBottomLeftRadius: '8px',
    });
    expect(unpackBorderRadius('10px')).toEqual({
      borderTopLeftRadius: '10px',
      borderTopRightRadius: '10px',
      borderBottomRightRadius: '10px',
      borderBottomLeftRadius: '10px',
    });
    expect(unpackBorderRadius('1px 2px 3px 4px')).toEqual({
      borderTopLeftRadius: '1px',
      borderTopRightRadius: '2px',
      borderBottomRightRadius: '3px',
      borderBottomLeftRadius: '4px',
    });
  });

  it('unpacks border-width shorthand into top, right, bottom, left', () => {
    expect(unpackBorderWidth('2px 4px')).toEqual({
      borderTopWidth: '2px',
      borderRightWidth: '4px',
      borderBottomWidth: '2px',
      borderLeftWidth: '4px',
    });
    expect(unpackBorderWidth('1px')).toEqual({
      borderTopWidth: '1px',
      borderRightWidth: '1px',
      borderBottomWidth: '1px',
      borderLeftWidth: '1px',
    });
  });
});
