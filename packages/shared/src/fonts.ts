// Curated Google Fonts allowlist and pairs for Brand font pair suggestions (TK-71).

export const ALLOWED_GOOGLE_FONTS = [
  'Inter',
  'Poppins',
  'Playfair Display',
  'Source Sans 3',
  'Space Grotesk',
  'DM Serif Display',
  'DM Sans',
  'Manrope',
  'Outfit',
  'Nunito Sans',
  'Lora',
  'Open Sans',
] as const;

export type GoogleFontFamily = (typeof ALLOWED_GOOGLE_FONTS)[number];

export type GoogleFontPair = {
  readonly id: string;
  readonly heading: GoogleFontFamily;
  readonly body: GoogleFontFamily;
  readonly tagKey: string;
};

export const GOOGLE_FONT_PAIRS: readonly GoogleFontPair[] = [
  { id: 'inter-inter', heading: 'Inter', body: 'Inter', tagKey: 'brand:fonts.pairModern' },
  { id: 'poppins-inter', heading: 'Poppins', body: 'Inter', tagKey: 'brand:fonts.pairStartup' },
  {
    id: 'playfair-sourcesans',
    heading: 'Playfair Display',
    body: 'Source Sans 3',
    tagKey: 'brand:fonts.pairEditorial',
  },
  {
    id: 'spacegrotesk-inter',
    heading: 'Space Grotesk',
    body: 'Inter',
    tagKey: 'brand:fonts.pairTech',
  },
  {
    id: 'dmserif-dmsans',
    heading: 'DM Serif Display',
    body: 'DM Sans',
    tagKey: 'brand:fonts.pairClassic',
  },
  { id: 'manrope-manrope', heading: 'Manrope', body: 'Manrope', tagKey: 'brand:fonts.pairClean' },
  {
    id: 'outfit-nunitosans',
    heading: 'Outfit',
    body: 'Nunito Sans',
    tagKey: 'brand:fonts.pairFriendly',
  },
  { id: 'lora-opensans', heading: 'Lora', body: 'Open Sans', tagKey: 'brand:fonts.pairReadable' },
] as const;

export function isAllowedGoogleFont(family: string): family is GoogleFontFamily {
  return (ALLOWED_GOOGLE_FONTS as readonly string[]).includes(family);
}

/** Builds a Google Fonts v2 CSS import URL from deduplicated allowlisted font families. */
export function googleFontsImportUrl(families: readonly GoogleFontFamily[]): string {
  const unique = Array.from(new Set(families));
  const params = unique
    .map((family) => `family=${family.trim().replace(/\s+/g, '+')}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
