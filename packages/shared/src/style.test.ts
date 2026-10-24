import { describe, expect, it } from 'vitest';

import { mediaForBreakpoint } from './style.ts';

describe('mediaForBreakpoint [R-ST-09]', () => {
  it('uses the same bands as Tailwind variants, and no @media on the base breakpoint', () => {
    expect(mediaForBreakpoint('base', 'desktop-first')).toBeUndefined();
    expect(mediaForBreakpoint('sm', 'desktop-first')).toBe('(max-width: 639px)');
    expect(mediaForBreakpoint('md', 'mobile-first')).toBe('(min-width: 768px)');
  });
});
