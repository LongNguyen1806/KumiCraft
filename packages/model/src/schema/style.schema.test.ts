import { describe, expect, it } from 'vitest';

import { BackgroundImageSchema, StateStylePropsSchema, StylePropsSchema } from './style.schema.ts';

const ok = (value: unknown) => StylePropsSchema.safeParse(value).success;

describe('StylePropsSchema', () => {
  it('accepts a typical card style', () => {
    expect(
      ok({
        gap: 'token:spacing.3',
        padding: { top: 'token:spacing.4', left: { px: 12 } },
        radius: 'token:radius.lg',
        background: 'token:color.surface',
        shadow: 'token:shadow.sm',
        width: 'fill',
        fontWeight: 600,
        opacity: 85,
        transition: { property: 'colors', durationMs: 150 },
      }),
    ).toBe(true);
  });

  it('rejects unknown properties and out-of-range values', () => {
    expect(ok({ color: '#ffffff' })).toBe(false);
    expect(ok({ columns: 13 })).toBe(false);
    expect(ok({ opacity: 33 })).toBe(false);
    expect(ok({ fontWeight: 450 })).toBe(false);
    expect(ok({ zIndex: 15 })).toBe(false);
    expect(ok({ borderWidth: { top: 3 } })).toBe(false);
    expect(ok({ transition: { property: 'all', durationMs: 250 } })).toBe(false);
  });

  it('checks token groups per property [V-01]', () => {
    expect(ok({ padding: { top: 'token:color.primary' } })).toBe(false);
    expect(ok({ radius: 'token:spacing.4' })).toBe(false);
  });

  it('allows stickyTop only with sticky position and no absolute positioning [V-37]', () => {
    expect(ok({ position: 'sticky', stickyTop: { px: 0 } })).toBe(true);
    expect(ok({ stickyTop: { px: 0 } })).toBe(false);
    expect(ok({ position: 'absolute' })).toBe(false);
    expect(ok({ position: 'fixed' })).toBe(false);
  });

  it('does not allow autoFit and columns in the same breakpoint [V-26]', () => {
    expect(ok({ autoFit: { minColumnWidth: { px: 240 } } })).toBe(true);
    expect(ok({ autoFit: { minColumnWidth: { px: 240 } }, columns: 3 })).toBe(false);
  });
});

describe('BackgroundImageSchema', () => {
  const gradient = (stops: readonly { color: string; at: number }[]) =>
    BackgroundImageSchema.safeParse({ kind: 'linear-gradient', angle: 90, stops }).success;

  it('needs 2 to 5 gradient stops in increasing order [V-38]', () => {
    expect(
      gradient([
        { color: '#000000', at: 0 },
        { color: '#ffffff', at: 100 },
      ]),
    ).toBe(true);
    expect(gradient([{ color: '#000000', at: 0 }])).toBe(false);
    expect(
      gradient([
        { color: '#000000', at: 60 },
        { color: '#ffffff', at: 40 },
      ]),
    ).toBe(false);
    expect(gradient(Array.from({ length: 6 }, (_, i) => ({ color: '#000000', at: i * 10 })))).toBe(
      false,
    );
  });

  it('accepts an image background', () => {
    expect(
      BackgroundImageSchema.safeParse({
        kind: 'image',
        src: 'asset:hero.jpg',
        size: 'cover',
        position: 'center',
        repeat: false,
      }).success,
    ).toBe(true);
  });
});

describe('StateStylePropsSchema', () => {
  it('allows only colour, shadow and opacity in states', () => {
    expect(StateStylePropsSchema.safeParse({ background: '#ffffff', opacity: 50 }).success).toBe(
      true,
    );
    expect(StateStylePropsSchema.safeParse({ padding: { top: { px: 4 } } }).success).toBe(false);
  });
});
