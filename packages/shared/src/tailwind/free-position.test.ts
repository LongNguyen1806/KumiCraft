// Unit tests for free-position utilities (SPEC-04 R-FF-11, R-FF-12).
import { describe, expect, it } from 'vitest';

import {
  applyPlacement,
  applySize,
  clearSize,
  hasFreePosition,
  pxClass,
  readClassPx,
  snap,
  tailwindMajorOf,
} from './free-position.ts';

describe('Free-position Tailwind utilities [R-FF-11, R-FF-12]', () => {
  it('Scenario 1: pxClass converts px to Tailwind v3 / v4 class [R-FF-11]', () => {
    expect(pxClass('left', 120, 4)).toBe('left-30');
    expect(pxClass('left', 122, 4)).toBe('left-[122px]');
    expect(pxClass('left', 120, 3)).toBe('left-[120px]');
    expect(pxClass('w', 200, 4)).toBe('w-50');
  });

  it('Scenario 2: snap rounds coordinates to nearest grid unit [R-FF-11]', () => {
    expect(snap(130, 8)).toBe(128);
    expect(snap(70, 8)).toBe(72);
    expect(snap(-5, 8)).toBe(0);
    expect(snap(13, 1)).toBe(13);
  });

  it('Scenario 3: applyPlacement with free keeps existing classes and appends placement classes [R-FF-11]', () => {
    const input = 'p-4 relative left-2 md:left-8 text-red-500';
    const result = applyPlacement(input, { kind: 'free', left: 128, top: 72 }, 4);
    expect(result).toBe('p-4 md:left-8 text-red-500 absolute left-32 top-18');
  });

  it('Scenario 4: applyPlacement with flow removes absolute/coordinates and retains dimension classes [R-FF-12]', () => {
    const input = 'absolute left-32 top-18 w-50 z-10 p-2';
    const result = applyPlacement(input, { kind: 'flow' });
    expect(result).toBe('w-50 p-2');
  });

  it('readClassPx reads scale, arbitrary and negative values; skips keywords, fractions and variants', () => {
    expect(readClassPx('left-30 top-[122px]', 'left')).toBe(120);
    expect(readClassPx('left-30 top-[122px]', 'top')).toBe(122);
    expect(readClassPx('-left-4', 'left')).toBe(-16);
    expect(readClassPx('w-px', 'width')).toBe(1);
    expect(readClassPx('w-1/2', 'width')).toBeUndefined();
    expect(readClassPx('w-full h-screen', 'width')).toBeUndefined();
    expect(readClassPx('md:left-8 min-w-40', 'left')).toBeUndefined();
    expect(readClassPx('min-w-40', 'width')).toBeUndefined();
  });

  it('applySize / clearSize touch only unprefixed w-/h- classes [R-FF-14]', () => {
    expect(applySize('w-full p-4 md:w-1/2', { width: 200 }, 4)).toBe('p-4 md:w-1/2 w-50');
    expect(applySize('h-10 p-4', { height: 122 }, 4)).toBe('p-4 h-[122px]');
    expect(clearSize('w-full h-[40px] min-w-0 md:w-8 p-2')).toBe('min-w-0 md:w-8 p-2');
  });

  it('hasFreePosition and tailwindMajorOf', () => {
    expect(hasFreePosition('absolute left-8 p-2')).toBe(true);
    expect(hasFreePosition('relative left-8')).toBe(false);
    expect(hasFreePosition('md:absolute md:left-8')).toBe(false);
    expect(tailwindMajorOf('^3.4.1')).toBe(3);
    expect(tailwindMajorOf('4.1.0')).toBe(4);
    expect(tailwindMajorOf(undefined)).toBe(4);
  });
});
