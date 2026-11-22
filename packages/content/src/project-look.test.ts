// Unit tests for project look role resolution (TK-43, tests 1-4).
import type { ThemeInfo } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { lookFromTheme, resolveCssRoles, resolveTailwindRoles } from './project-look.ts';

function makeTheme(overrides: Partial<ThemeInfo> = {}): ThemeInfo {
  return {
    colors: [],
    fontSizes: [],
    radii: [],
    fonts: [],
    shadows: [],
    breakpoints: [],
    ...overrides,
  };
}

describe('project-look', () => {
  it('1. lookFromTheme resolves primary vs brand priority and returns empty roles for empty theme', () => {
    const withPrimary = lookFromTheme(
      makeTheme({ colors: [{ name: 'primary', value: '#4f46e5' }] }),
    );
    expect(withPrimary.roles.primary).toEqual({ tailwind: 'primary', css: '#4f46e5' });

    const withBrandOnly = lookFromTheme(
      makeTheme({ colors: [{ name: 'brand', value: '#3b82f6' }] }),
    );
    expect(withBrandOnly.roles.primary).toEqual({ tailwind: 'brand', css: '#3b82f6' });

    const withBoth = lookFromTheme(
      makeTheme({
        colors: [
          { name: 'brand', value: '#3b82f6' },
          { name: 'Primary', value: '#4f46e5' },
        ],
      }),
    );
    expect(withBoth.roles.primary).toEqual({ tailwind: 'Primary', css: '#4f46e5' });

    expect(lookFromTheme(makeTheme()).roles).toEqual({});
    expect(lookFromTheme(undefined).roles).toEqual({});
  });

  it('a framework built-in radius scale is not the project look; a radius the project set is', () => {
    const builtIn = lookFromTheme(
      makeTheme({ radii: [{ name: 'DEFAULT', value: '0.25rem', inherited: true }] }),
    );
    expect(builtIn.roles.radius).toBeUndefined();
    expect(resolveTailwindRoles('rounded-{radius}', builtIn)).toBe('rounded-lg');

    const own = lookFromTheme(
      makeTheme({ radii: [{ name: 'radius', value: '12px', variable: '--radius' }] }),
    );
    expect(resolveTailwindRoles('rounded-{radius}', own)).toBe('rounded-radius');
  });

  it('2. lookFromTheme maps shadcn-style token names to all 6 semantic color roles', () => {
    const look = lookFromTheme(
      makeTheme({
        colors: [
          { name: 'background', value: '#ffffff', variable: '--background' },
          { name: 'foreground', value: '#09090b', variable: '--foreground' },
          { name: 'primary', value: '#18181b', variable: '--primary' },
          { name: 'primary-foreground', value: '#fafafa', variable: '--primary-foreground' },
          { name: 'muted-foreground', value: '#71717a', variable: '--muted-foreground' },
          { name: 'border', value: '#e4e4e7', variable: '--border' },
        ],
      }),
    );

    expect(look.roles.surface).toEqual({ tailwind: 'background', css: 'var(--background)' });
    expect(look.roles.text).toEqual({ tailwind: 'foreground', css: 'var(--foreground)' });
    expect(look.roles.primary).toEqual({ tailwind: 'primary', css: 'var(--primary)' });
    expect(look.roles['on-primary']).toEqual({
      tailwind: 'primary-foreground',
      css: 'var(--primary-foreground)',
    });
    expect(look.roles.muted).toEqual({
      tailwind: 'muted-foreground',
      css: 'var(--muted-foreground)',
    });
    expect(look.roles.border).toEqual({ tailwind: 'border', css: 'var(--border)' });
  });

  it('3. resolveTailwindRoles replaces tokens, falls back to defaults, and drops unset heading without extra spaces', () => {
    const brandLook = lookFromTheme(makeTheme({ colors: [{ name: 'brand', value: '#3b82f6' }] }));
    expect(resolveTailwindRoles('bg-{primary} hover:bg-{primary}/90', brandLook)).toBe(
      'bg-brand hover:bg-brand/90',
    );

    const emptyLook = lookFromTheme(undefined);
    expect(resolveTailwindRoles('bg-{primary} hover:bg-{primary}/90', emptyLook)).toBe(
      'bg-blue-600 hover:bg-blue-600/90',
    );

    expect(resolveTailwindRoles('text-2xl font-{heading} font-bold', emptyLook)).toBe(
      'text-2xl font-bold',
    );

    const headingLook = lookFromTheme(
      makeTheme({ fonts: [{ name: 'heading', value: 'Poppins, sans-serif' }] }),
    );
    expect(resolveTailwindRoles('text-2xl font-{heading} font-bold', headingLook)).toBe(
      'text-2xl font-heading font-bold',
    );
  });

  it('4. resolveCssRoles uses var() for CSS variables, literal value without variable, defaults when absent, and drops unset heading', () => {
    const withVar = lookFromTheme(
      makeTheme({
        colors: [{ name: 'primary', value: '#4f46e5', variable: '--primary' }],
      }),
    );
    expect(
      resolveCssRoles(
        {
          'background-color': '{primary}',
          color: '{on-primary}',
          'font-family': '{heading}',
        },
        withVar,
      ),
    ).toEqual({
      'background-color': 'var(--primary)',
      color: '#ffffff',
    });

    const withoutVar = lookFromTheme(
      makeTheme({
        colors: [{ name: 'primary', value: '#4f46e5' }],
        fonts: [{ name: 'heading', value: 'Outfit, sans-serif', variable: '--font-heading' }],
      }),
    );
    expect(
      resolveCssRoles(
        {
          'background-color': '{primary}',
          'font-family': '{heading}',
          border: '1px solid {border}',
        },
        withoutVar,
      ),
    ).toEqual({
      'background-color': '#4f46e5',
      'font-family': 'var(--font-heading)',
      border: '1px solid #e5e7eb',
    });
  });

  it('20. [TK-69] lookFromTheme applies style presets while preserving project primary color', () => {
    const theme = makeTheme({
      colors: [{ name: 'brand', value: '#e11d48', variable: '--color-brand' }],
      radii: [{ name: 'radius', value: '10px', variable: '--radius' }],
    });

    const glass = lookFromTheme(theme, 'glass');
    expect(glass.roles.effect?.tailwind).toContain('backdrop-blur-md');
    expect(glass.roles.primary).toEqual({ tailwind: 'brand', css: 'var(--color-brand)' });
    expect(
      resolveCssRoles({ 'background-color': '{surface}', 'backdrop-filter': '{effect}' }, glass),
    ).toEqual({
      'backdrop-filter': 'blur(12px)',
      'background-color': 'rgba(255, 255, 255, 0.6)',
    });

    // One translucent surface and border, no second white color for the Inspector to fight with.
    expect(
      resolveTailwindRoles(
        'p-6 bg-{surface} border border-{border} border-2 border-{primary} rounded-{radius} {effect}',
        glass,
      ),
    ).toBe(
      'p-6 bg-white/60 border border-gray-200/40 border-2 border-brand rounded-xl backdrop-blur-md',
    );
    expect(resolveTailwindRoles('p-6 rounded-{radius} {effect}', glass)).toBe(
      'p-6 rounded-xl backdrop-blur-md bg-white/60',
    );

    const minimal = lookFromTheme(theme, 'minimal');
    expect(minimal.roles.shadow?.tailwind).toBe('shadow-none');
    expect(minimal.roles.radius?.tailwind).toBe('sm');
    expect(minimal.roles.primary).toEqual({ tailwind: 'brand', css: 'var(--color-brand)' });
    expect(resolveTailwindRoles('bg-{surface} rounded-{radius} {shadow} {effect}', minimal)).toBe(
      'bg-white rounded-sm shadow-none',
    );

    const bold = lookFromTheme(theme, 'bold');
    expect(bold.roles.shadow?.tailwind).toBe('shadow-xl');
    expect(bold.roles.primary).toEqual({ tailwind: 'brand', css: 'var(--color-brand)' });
    expect(
      resolveTailwindRoles('px-4 py-2 bg-{primary} text-{on-primary} hover:bg-{primary}/90', bold),
    ).toBe('px-4 py-2 bg-gradient-to-r from-brand to-brand/80 text-white hover:opacity-90');
  });
});
