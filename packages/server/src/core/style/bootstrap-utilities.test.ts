import { describe, expect, it } from 'vitest';

import { parseUtility, utilityFor } from './bootstrap-utilities.ts';

describe('bootstrap-utilities [R-ST-10]', () => {
  it('parses utility classes with breakpoints and grouped edges, rejecting component classes [R-ST-10]', () => {
    expect(parseUtility('pt-md-3')).toEqual({
      property: 'paddingTop',
      breakpoint: 'md',
      suffix: '3',
    });
    expect(parseUtility('p-3')).toEqual({
      property: 'paddingTop',
      suffix: '3',
    });
    expect(parseUtility('d-lg-flex')).toEqual({
      property: 'display',
      breakpoint: 'lg',
      suffix: 'flex',
    });
    expect(parseUtility('card')).toBeUndefined();
    expect(parseUtility('btn')).toBeUndefined();
    expect(parseUtility('text-muted')).toBeUndefined();
    expect(parseUtility('d-print-none')).toBeUndefined();
  });

  it('maps CSS values on the Bootstrap scale to utility classes and returns undefined off-scale [R-ST-10]', () => {
    expect(utilityFor('paddingTop', '1.5rem')).toBe('pt-4');
    expect(utilityFor('paddingTop', '20px')).toBeUndefined();
    expect(utilityFor('fontWeight', '700')).toBe('fw-bold');
    expect(utilityFor('paddingTop', '24px', 'md')).toBe('pt-md-4');
    expect(utilityFor('fontWeight', '700', 'md')).toBeUndefined();
  });
});
