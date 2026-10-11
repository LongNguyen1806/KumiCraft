// Unit tests for normalizeResponsiveStyle (V-29).
import { describe, expect, it } from 'vitest';

import type { ResponsiveKey } from '../schema/primitives.schema.ts';
import type { StyleProps } from '../schema/style.schema.ts';
import { normalizeResponsiveStyle } from './normalize-responsive.ts';

describe('normalizeResponsiveStyle (V-29)', () => {
  it('removes duplicate properties in desktop-first cascade', () => {
    const base: StyleProps = {
      padding: {
        top: 'token:spacing.6',
        right: 'token:spacing.6',
        bottom: 'token:spacing.6',
        left: 'token:spacing.6',
      },
      textColor: 'token:color.primary',
    };

    const responsive: Partial<Record<ResponsiveKey, StyleProps>> = {
      xl: {
        // Same as base: should be removed
        padding: {
          top: 'token:spacing.6',
          right: 'token:spacing.6',
          bottom: 'token:spacing.6',
          left: 'token:spacing.6',
        },
        // Different from base: should be kept
        textColor: '#000000',
      },
      md: {
        // Different from xl: should be kept
        textColor: '#111111',
        // Different from base: should be kept
        padding: {
          top: 'token:spacing.2',
          right: 'token:spacing.2',
          bottom: 'token:spacing.2',
          left: 'token:spacing.2',
        },
      },
      sm: {
        // Same as md: should be removed
        textColor: '#111111',
      },
    };

    const result = normalizeResponsiveStyle(base, responsive, 'desktop-first');
    expect(result).toBeDefined();
    expect(result?.xl).toEqual({ textColor: '#000000' });
    expect(result?.md).toEqual({
      textColor: '#111111',
      padding: {
        top: 'token:spacing.2',
        right: 'token:spacing.2',
        bottom: 'token:spacing.2',
        left: 'token:spacing.2',
      },
    });
    expect(result?.sm).toBeUndefined();
  });

  it('removes duplicate properties in mobile-first cascade', () => {
    const base: StyleProps = {
      columns: 1,
      gap: 'token:spacing.2',
    };

    const responsive: Partial<Record<ResponsiveKey, StyleProps>> = {
      sm: {
        columns: 1, // duplicate of base
      },
      md: {
        columns: 2, // new value
        gap: 'token:spacing.2', // duplicate of base
      },
      lg: {
        columns: 2, // duplicate of md
      },
      xl: {
        columns: 4, // new value
      },
    };

    const result = normalizeResponsiveStyle(base, responsive, 'mobile-first');
    expect(result).toBeDefined();
    expect(result?.sm).toBeUndefined();
    expect(result?.md).toEqual({ columns: 2 });
    expect(result?.lg).toBeUndefined();
    expect(result?.xl).toEqual({ columns: 4 });
  });

  it('returns undefined if all responsive properties duplicate earlier breakpoints', () => {
    const base = { columns: 2 };
    const responsive = { md: { columns: 2 } };

    const result = normalizeResponsiveStyle(base, responsive, 'desktop-first');
    expect(result).toBeUndefined();
  });
});
