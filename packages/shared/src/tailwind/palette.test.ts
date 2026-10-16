import { describe, expect, it } from 'vitest';

import { TAILWIND_COLORS } from './palette.generated.ts';

describe('TAILWIND_COLORS', () => {
  it('carries the default Tailwind palette with black and white [R-IN-19]', () => {
    expect(TAILWIND_COLORS).toContainEqual({
      name: 'red-50',
      value: 'oklch(97.1% 0.013 17.38)',
    });
    expect(TAILWIND_COLORS).toContainEqual({
      name: 'black',
      value: '#000',
    });
    expect(TAILWIND_COLORS).toContainEqual({
      name: 'white',
      value: '#fff',
    });

    const names = TAILWIND_COLORS.map((c) => c.name);
    expect(names).toContain('slate-200');
    expect(names).toContain('blue-500');
    expect(names).toContain('rose-950');

    const nameSet = new Set(names);
    expect(nameSet.size).toBe(names.length);
  });
});
