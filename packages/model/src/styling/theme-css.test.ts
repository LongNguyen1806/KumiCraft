// Unit tests for theme CSS generator and R-SM-04, R-SM-05 rules (SPEC-04.1 section 5.6).
import { describe, expect, it } from 'vitest';

import { createDefaultTokens } from '../tokens/default-tokens.ts';
import { generateThemeCss, validateTokenNameCollisions } from './theme-css.ts';

describe('generateThemeCss', () => {
  it('generates Tailwind v4 @theme block for default tokens', () => {
    const tokens = createDefaultTokens();
    const css = generateThemeCss(tokens);

    expect(css).toContain('@theme {');
    expect(css).toContain('--color-primary: #2563eb;');
    expect(css).toContain('--spacing-4: 16px;');
    expect(css).toContain('--radius-md: 6px;');
    expect(css).toContain('--text-base: 16px;');
    expect(css).toContain('--text-base--line-height: 1.5;');
    expect(css).toContain('--font-weight-semibold: 600;');
    expect(css).toContain('--leading-normal: 1.5;');
    expect(css).toContain(
      '--font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";',
    );
  });

  it('generates .dark block when dark mode colors exist with class mode', () => {
    const tokens = createDefaultTokens();
    tokens.color['background'] = { value: '#ffffff', dark: '#0f172a' };
    tokens.color['foreground'] = { value: '#0f172a', dark: '#f8fafc' };

    const css = generateThemeCss(tokens, { darkMode: 'class' });
    expect(css).toContain('.dark {');
    expect(css).toContain('--color-background: #0f172a;');
    expect(css).toContain('--color-foreground: #f8fafc;');
  });

  it('generates media query block when darkMode is media', () => {
    const tokens = createDefaultTokens();
    tokens.color['background'] = { value: '#ffffff', dark: '#0f172a' };

    const css = generateThemeCss(tokens, { darkMode: 'media' });
    expect(css).toContain('@media (prefers-color-scheme: dark) {');
    expect(css).toContain(':root {');
    expect(css).toContain('--color-background: #0f172a;');
  });

  it('omits dark mode block when darkMode is none', () => {
    const tokens = createDefaultTokens();
    tokens.color['background'] = { value: '#ffffff', dark: '#0f172a' };

    const css = generateThemeCss(tokens, { darkMode: 'none' });
    expect(css).not.toContain('.dark');
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('enforces R-SM-05: throws when fontWeight and fontFamily share a token name', () => {
    const tokens = createDefaultTokens();
    tokens.fontWeight['sans'] = { value: 400 }; // Collision with fontFamily 'sans'

    expect(() => {
      validateTokenNameCollisions(tokens);
    }).toThrow(/R-SM-05/);
    expect(() => {
      generateThemeCss(tokens);
    }).toThrow(/R-SM-05/);
  });
});
