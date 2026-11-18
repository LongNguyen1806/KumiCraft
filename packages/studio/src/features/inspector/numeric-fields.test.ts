// The number fields with a slider (owner, 2026-11-18): each value reads back and writes the class
// Tailwind 3 or 4 (or the CSS) needs, and a typed value is checked before anything is written.
import { type ClassContext, parseClasses } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { readTwTokenStr } from './components/effects-helpers.ts';
import {
  cssValueOf,
  numberFromCss,
  numberFromTw,
  NUMERIC_FIELDS as F,
  type NumericField,
  parseTyped,
  previewDeclarations,
  steppedValue,
  twValueOf,
} from './numeric-fields.ts';

describe('numeric fields [R-IN-13]', () => {
  it('writes any number in Tailwind 4 and a named class or […] in Tailwind 3', () => {
    expect(twValueOf(F.rotate, 15, 4)).toEqual({ kind: 'scale', token: '15' });
    expect(twValueOf(F.rotate, -45, 3)).toEqual({ kind: 'scale', token: '-45' });
    expect(twValueOf(F.rotate, 15, 3)).toEqual({ kind: 'arbitrary', css: '15deg' });
    expect(twValueOf(F.scale, 102, 3)).toEqual({ kind: 'arbitrary', css: '1.02' });
    expect(twValueOf(F.translateX, 15, 4)).toEqual({ kind: 'scale', token: '3.75' });
    expect(twValueOf(F.translateX, -16, 3)).toEqual({ kind: 'scale', token: '-4' });
    expect(twValueOf(F.translateX, 15, 3)).toEqual({ kind: 'arbitrary', css: '15px' });
    expect(twValueOf(F.blur, 12, 4)).toEqual({ kind: 'scale', token: 'md' });
    expect(twValueOf(F.blur, 8, 3)).toEqual({ kind: 'scale', token: 'DEFAULT' });
    expect(twValueOf(F.blur, 10, 4)).toEqual({ kind: 'arbitrary', css: '10px' });
    expect(twValueOf(F.grayscale, 100, 4)).toEqual({ kind: 'scale', token: 'DEFAULT' });
    expect(twValueOf(F.grayscale, 50, 3)).toEqual({ kind: 'arbitrary', css: '0.5' });
    expect(twValueOf(F.duration, 400, 4)).toEqual({ kind: 'scale', token: '400' });
    expect(twValueOf(F.duration, 400, 3)).toEqual({ kind: 'arbitrary', css: '400ms' });
  });

  it('reads back what it wrote, and what a project already had', () => {
    expect(numberFromTw(F.rotate, '-45')).toBe(-45);
    expect(numberFromTw(F.rotate, '[15deg]')).toBe(15);
    expect(numberFromTw(F.scale, '[1.02]')).toBe(102);
    expect(numberFromTw(F.translateX, '3.75')).toBe(15);
    expect(numberFromTw(F.translateX, 'px')).toBe(1);
    expect(numberFromTw(F.translateX, '1/2')).toBeUndefined();
    expect(numberFromTw(F.blur, 'md')).toBe(12);
    expect(numberFromTw(F.grayscale, 'DEFAULT')).toBe(100);
    expect(numberFromTw(F.duration, '[1s]')).toBe(1000);
    expect(numberFromCss(F.scale, '1.05')).toBe(105);
    expect(numberFromCss(F.backdropBlur, 'blur(12px)')).toBe(12);
    expect(numberFromCss(F.rotate, '45deg')).toBe(45);
    expect(cssValueOf(F.scale, 105)).toBe('1.05');
    expect(cssValueOf(F.rotate, -15)).toBe('-15deg');
  });

  it('reads a negative class with its sign (owner, 2026-11-18: -100px showed as 100px)', () => {
    const ctx: ClassContext = {
      theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
      mode: 'desktop-first',
      breakpoints: {},
    };
    const read = (classes: string, field: NumericField) =>
      numberFromTw(
        field,
        readTwTokenStr(parseClasses(classes, ctx), { breakpoint: 'base' }, field.prop),
      );
    expect(read('-translate-x-25', F.translateX)).toBe(-100);
    expect(read('translate-x-25', F.translateX)).toBe(100);
    expect(read('-rotate-45', F.rotate)).toBe(-45);
    expect(read('-skew-x-7', F.skewX)).toBe(-7);
    expect(read('translate-x-[-15px]', F.translateX)).toBe(-15);
  });

  it('takes a typed number with its unit, and says why it refuses one', () => {
    expect(parseTyped(F.rotate, ' 15deg ')).toEqual({ kind: 'value', value: 15 });
    expect(parseTyped(F.rotate, '15°')).toEqual({ kind: 'value', value: 15 });
    expect(parseTyped(F.duration, '400ms')).toEqual({ kind: 'value', value: 400 });
    expect(parseTyped(F.rotate, '')).toEqual({ kind: 'empty' });
    expect(parseTyped(F.rotate, 'abc')).toMatchObject({ reason: 'notNumber' });
    expect(parseTyped(F.rotate, '--5')).toMatchObject({ reason: 'notNumber' });
    expect(parseTyped(F.rotate, '12px')).toMatchObject({ reason: 'notNumber' });
    expect(parseTyped(F.rotate, '12,5')).toMatchObject({ reason: 'notInteger' });
    expect(parseTyped(F.rotate, '999')).toEqual({ kind: 'error', reason: 'tooBig', limit: 360 });
    expect(parseTyped(F.blur, '-1')).toEqual({ kind: 'error', reason: 'tooSmall', limit: 0 });
  });

  it('steps by one, ten with Shift, inside the limits', () => {
    expect(steppedValue(F.rotate, 14, true, false)).toBe(15);
    expect(steppedValue(F.rotate, undefined, false, true)).toBe(-10);
    expect(steppedValue(F.scale, undefined, true, false)).toBe(101);
    expect(steppedValue(F.grayscale, 95, true, true)).toBe(100);
  });

  it('previews the whole transform, so the other parts stay while one is dragged', () => {
    const decls = previewDeclarations('rotate', { rotate: 15, scale: 110 });
    expect(decls[0]).toEqual({
      property: 'transform',
      value: 'translate(0px, 0px) rotate(15deg) skewX(0deg) scale(1.1)',
    });
    expect(decls.map((d) => d.property)).toEqual(['transform', 'translate', 'rotate', 'scale']);
    expect(previewDeclarations('duration', { duration: 400 })).toEqual([]);
  });
});
