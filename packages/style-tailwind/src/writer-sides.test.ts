// Tests for individual border sides and corners [WP-4.00, B5]
import { describe, expect, it } from 'vitest';

import type { ClassContext } from './types.ts';
import { writeValue } from './writer.ts';

const ctx: ClassContext = {
  theme: {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
  },
  mode: 'desktop-first',
  breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
};

describe('Tailwind border sides and corners [WP-4.00, B5]', () => {
  it('writes individual sides resulting in border-t-2 border-b-4 [WP-4.00]', () => {
    let cls = writeValue(
      '',
      'borderTopWidth',
      { breakpoint: 'base' },
      { kind: 'scale', token: '2' },
      ctx,
    );
    expect(cls).toBe('border-t-2');
    cls = writeValue(
      cls,
      'borderBottomWidth',
      { breakpoint: 'base' },
      { kind: 'scale', token: '4' },
      ctx,
    );
    expect(cls).toBe('border-t-2 border-b-4');
  });

  it('merges 4 equal sides into border-2 [WP-4.00]', () => {
    let cls = 'border-t-2 border-b-2';
    cls = writeValue(
      cls,
      'borderRightWidth',
      { breakpoint: 'base' },
      { kind: 'scale', token: '2' },
      ctx,
    );
    cls = writeValue(
      cls,
      'borderLeftWidth',
      { breakpoint: 'base' },
      { kind: 'scale', token: '2' },
      ctx,
    );
    expect(cls).toBe('border-2');
  });

  it('splits border-2 when setting individual side to different value [WP-4.00]', () => {
    const cls = writeValue(
      'border-2',
      'borderBottomWidth',
      { breakpoint: 'base' },
      { kind: 'scale', token: '4' },
      ctx,
    );
    expect(cls).toContain('border-b-4');
    expect(cls).toContain('border-t-2');
    expect(cls).not.toContain('border-2');
  });

  it('writes individual corners resulting in rounded-tl-lg rounded-br-lg [WP-4.00]', () => {
    let cls = writeValue(
      '',
      'borderTopLeftRadius',
      { breakpoint: 'base' },
      { kind: 'scale', token: 'lg' },
      ctx,
    );
    expect(cls).toBe('rounded-tl-lg');
    cls = writeValue(
      cls,
      'borderBottomRightRadius',
      { breakpoint: 'base' },
      { kind: 'scale', token: 'lg' },
      ctx,
    );
    expect(cls).toBe('rounded-tl-lg rounded-br-lg');
  });

  it('merges 4 equal corners into rounded-lg [WP-4.00]', () => {
    let cls = 'rounded-tl-lg rounded-br-lg';
    cls = writeValue(
      cls,
      'borderTopRightRadius',
      { breakpoint: 'base' },
      { kind: 'scale', token: 'lg' },
      ctx,
    );
    cls = writeValue(
      cls,
      'borderBottomLeftRadius',
      { breakpoint: 'base' },
      { kind: 'scale', token: 'lg' },
      ctx,
    );
    expect(cls).toBe('rounded-lg');
  });
});
