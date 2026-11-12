// Which typed values the Inspector writes for open-scale properties (spec-log #123).
import { describe, expect, it } from 'vitest';

import { isOpenScale, isValidScaleValue } from './scale-values.ts';

const ok = (property: Parameters<typeof isValidScaleValue>[0], value: string, major: 3 | 4 = 4) =>
  isValidScaleValue(property, value, [], major);

describe('isValidScaleValue', () => {
  it('takes any Tailwind 4 spacing (a multiple of 0.25), px and a CSS length in brackets', () => {
    for (const value of [
      '0',
      '5',
      '13',
      '2.5',
      '0.25',
      '96',
      '200',
      'px',
      '[13px]',
      '[1.5rem]',
      '[calc(100%-2rem)]',
      '',
    ]) {
      expect(ok('marginBottom', value), value).toBe(true);
    }
    for (const value of ['abc', '2.3', '-4', '[13', '[13]', '[ 4px ]', '13px']) {
      expect(ok('marginBottom', value), value).toBe(false);
    }
  });

  it('keeps Tailwind 3 to its own scale', () => {
    expect(ok('padding', '14', 3)).toBe(true);
    expect(ok('padding', '13', 3)).toBe(false);
    expect(ok('borderWidth', '3', 3)).toBe(false);
    expect(ok('borderWidth', '3', 4)).toBe(true);
    expect(ok('opacity', '35', 3)).toBe(true);
    expect(ok('opacity', '37', 3)).toBe(false);
    expect(ok('opacity', '35', 4)).toBe(true);
    expect(ok('width', '2/7', 3)).toBe(false);
    expect(ok('width', '2/7', 4)).toBe(true);
  });

  it('takes size words, fractions, z-index, grid columns and opacity in range', () => {
    for (const [property, value] of [
      ['width', 'full'],
      ['maxWidth', 'prose'],
      ['height', 'dvh'],
      ['width', '1/3'],
      ['zIndex', '999'],
      ['gridCols', '16'],
      ['opacity', '100'],
      ['lineHeight', '7'],
    ] as const) {
      expect(ok(property, value), `${property} ${value}`).toBe(true);
    }
    expect(ok('opacity', '120')).toBe(false);
    expect(ok('gridCols', '0')).toBe(false);
    expect(ok('width', '1/0')).toBe(false);
  });

  it('takes a named value only when it is one of the suggestions, or in brackets', () => {
    expect(isValidScaleValue('fontSize', 'hero', ['hero', 'lg'], 4)).toBe(true);
    expect(isValidScaleValue('fontSize', 'huge', ['hero', 'lg'], 4)).toBe(false);
    expect(isValidScaleValue('fontSize', '[15px]', ['hero'], 4)).toBe(true);
  });

  it('leaves keyword properties as a select', () => {
    expect(isOpenScale('display')).toBe(false);
    expect(isOpenScale('fontWeight')).toBe(false);
    expect(isOpenScale('marginBottom')).toBe(true);
  });
});
