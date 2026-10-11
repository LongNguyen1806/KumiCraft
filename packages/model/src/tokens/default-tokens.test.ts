import { describe, expect, it } from 'vitest';

import { DesignTokensSchema } from '../schema/document.schema.ts';
import { createDefaultTokens } from './default-tokens.ts';

describe('createDefaultTokens', () => {
  const tokens = createDefaultTokens();

  it('passes the token schema', () => {
    expect(DesignTokensSchema.safeParse(tokens).success).toBe(true);
  });

  it('matches the Tailwind v4 scale of SPEC-04.1 section 4', () => {
    expect(Object.keys(tokens.color)).toHaveLength(12);
    expect(tokens.color['primary']).toEqual({ value: '#2563eb' });
    expect(tokens.spacing['6']).toEqual({ value: { px: 24 } });
    expect(tokens.spacing['24']).toEqual({ value: { px: 96 } });
    expect(tokens.radius['full']).toEqual({ value: { px: 9999 } });
    expect(tokens.fontSize['base']).toEqual({ value: { size: { px: 16 }, lineHeight: 1.5 } });
    expect(tokens.fontWeight['semibold']).toEqual({ value: 600 });
    expect(tokens.lineHeight['relaxed']).toEqual({ value: 1.625 });
    expect(tokens.fontFamily['mono']?.value[0]).toBe('ui-monospace');
  });

  it('returns a new object on every call', () => {
    const other = createDefaultTokens();

    other.color['primary'] = { value: '#000000' };

    expect(createDefaultTokens().color['primary']).toEqual({ value: '#2563eb' });
    expect(other).not.toBe(tokens);
  });
});
