// One choice for the whole motion effect (the owner's report, 2026-11-18): a preset once picked
// could not be taken off, its hover parts sitting in other groups.
import { describe, expect, it } from 'vitest';

import { presetShown, twPresetEntries } from './motion-presets.ts';

const base = { breakpoint: 'base' } as const;

describe('motion presets', () => {
  it('"None" removes every class a preset writes, hover parts included [TK-16]', () => {
    const entries = twPresetEntries('none', base);
    expect(entries.every((e) => e.value === undefined)).toBe(true);
    const at = (p: string, state?: string) =>
      entries.some((e) => e.property === p && e.scope?.state === state);
    expect(at('transitionProperty')).toBe(true);
    expect(at('duration')).toBe(true);
    expect(at('animation')).toBe(true);
    expect(at('translateY', 'hover')).toBe(true);
    expect(at('boxShadow', 'hover')).toBe(true);
  });

  it('a preset takes the others off and puts its own on, once per property [TK-16]', () => {
    const entries = twPresetEntries('hover-scale', base);
    const keys = entries.map((e) => `${e.property}@${e.scope?.state ?? 'base'}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(entries.find((e) => e.property === 'scale')?.value).toEqual({
      kind: 'scale',
      token: '105',
    });
    expect(entries.find((e) => e.property === 'translateY')?.value).toBe(undefined);
  });

  it('names the preset shown, none, or custom [TK-16]', () => {
    const read = (values: Record<string, string>) => (p: string) => values[p] ?? '';
    expect(presetShown(read({}), true)).toBe('none');
    expect(presetShown(read({ transitionProperty: 'all', duration: '200' }), true)).toBe(
      'hover-lift',
    );
    expect(presetShown(read({ transitionProperty: 'all', duration: '500' }), true)).toBe('custom');
    expect(presetShown(read({ animation: 'fade-in' }), true)).toBe('fade-in');
  });
});
