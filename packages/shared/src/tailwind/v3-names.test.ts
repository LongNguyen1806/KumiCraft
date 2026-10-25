import { describe, expect, it } from 'vitest';

import {
  V3_TO_V4_UTILITY,
  v3ToV4Class,
  v3ToV4Classes,
  V4_TO_V3_UTILITY,
  v4ToV3Class,
  v4ToV3Classes,
} from './v3-names.ts';

describe('Tailwind v3 <-> v4 class name mapping [R-ST-02]', () => {
  it('6. [R-ST-02] translates both ways in one step, preserving variants and arbitrary values', () => {
    for (const [v4, v3] of Object.entries(V4_TO_V3_UTILITY)) {
      expect(v4ToV3Class(v4)).toBe(v3);
      expect(v3ToV4Class(v3)).toBe(v4);
      expect(V3_TO_V4_UTILITY[v3]).toBe(v4);
    }

    // Single-step lookup: shadow-sm -> shadow (not shadow-xs -> shadow-sm)
    expect(v4ToV3Class('shadow-sm')).toBe('shadow');
    expect(v4ToV3Class('shadow-xs')).toBe('shadow-sm');
    expect(v3ToV4Class('shadow')).toBe('shadow-sm');
    expect(v3ToV4Class('shadow-sm')).toBe('shadow-xs');

    // Variants and important modifier preserved
    expect(v4ToV3Class('md:hover:shadow-sm')).toBe('md:hover:shadow');
    expect(v3ToV4Class('md:hover:shadow')).toBe('md:hover:shadow-sm');
    expect(v4ToV3Class('focus:!outline-hidden')).toBe('focus:!outline-none');
    expect(v3ToV4Class('focus:!outline-none')).toBe('focus:!outline-hidden');

    // Arbitrary values and unlisted classes remain untouched
    expect(v4ToV3Class('shadow-[0_4px_12px_rgba(0,0,0,0.1)]')).toBe(
      'shadow-[0_4px_12px_rgba(0,0,0,0.1)]',
    );
    expect(v4ToV3Class('rounded-xl')).toBe('rounded-xl');
    expect(v4ToV3Class('p-4')).toBe('p-4');

    // Class list preserves spacing and translates in one pass
    const listV4 =
      'p-6  bg-white rounded-sm shadow-sm shadow-xs grow shrink ring-3 blur-xs blur-sm';
    const listV3 = v4ToV3Classes(listV4);
    expect(listV3).toBe(
      'p-6  bg-white rounded shadow shadow-sm flex-grow flex-shrink ring blur-sm blur',
    );
    expect(v3ToV4Classes(listV3)).toBe(listV4);
  });
});
