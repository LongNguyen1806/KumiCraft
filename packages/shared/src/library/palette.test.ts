// Unit tests for pure WCAG palette generator and curated font pairs (TK-70, TK-71, test 21).
import { describe, expect, it } from 'vitest';

import {
  ALLOWED_GOOGLE_FONTS,
  GOOGLE_FONT_PAIRS,
  googleFontsImportUrl,
  isAllowedGoogleFont,
} from './fonts.ts';
import { contrastRatio, generatePalette } from './palette.ts';

describe('palette and font pairs', () => {
  it('21. [TK-70] dark seed -> white primary-foreground; light seed -> near-black; all pairs >= 4.5 contrast', () => {
    const darkPalette = generatePalette('#1e293b');
    expect(darkPalette.tokens['primary-foreground']).toBe('#ffffff');
    expect(Object.keys(darkPalette.tokens)).toEqual([
      'primary',
      'primary-foreground',
      'background',
      'foreground',
      'muted',
      'muted-foreground',
      'border',
    ]);
    for (const pair of darkPalette.pairs) {
      expect(pair.ratio, `pair ${pair.id}`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(darkPalette.tokens[pair.foreground], darkPalette.tokens[pair.background]),
      ).toBeGreaterThanOrEqual(4.5);
    }

    const lightPalette = generatePalette('#fde047');
    expect(lightPalette.tokens['primary-foreground']).toBe('#09090b');
    for (const pair of lightPalette.pairs) {
      expect(pair.ratio, `pair ${pair.id}`).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(lightPalette.tokens[pair.foreground], lightPalette.tokens[pair.background]),
      ).toBeGreaterThanOrEqual(4.5);
    }

    // Even tricky mid-brightness hues meet >= 4.5 contrast
    for (const seed of ['#2563eb', '#10b981', '#f97316', '#ec4899', '#84cc16']) {
      const palette = generatePalette(seed);
      for (const pair of palette.pairs) {
        expect(pair.ratio, `${seed} / ${pair.id}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('[TK-71] font allowlist covers all 8 Google font pairs and builds safe import URL', () => {
    expect(GOOGLE_FONT_PAIRS).toHaveLength(8);
    for (const pair of GOOGLE_FONT_PAIRS) {
      expect(isAllowedGoogleFont(pair.heading)).toBe(true);
      expect(isAllowedGoogleFont(pair.body)).toBe(true);
    }
    expect(isAllowedGoogleFont('EvilFont')).toBe(false);
    expect(ALLOWED_GOOGLE_FONTS.length).toBe(12);
    expect(googleFontsImportUrl(['Playfair Display', 'Source Sans 3'])).toBe(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap',
    );
  });
});
