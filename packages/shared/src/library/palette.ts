// Pure HSL + WCAG contrast color palette generator from a seed hex color (TK-70).

export const PALETTE_TOKEN_NAMES = [
  'primary',
  'primary-foreground',
  'background',
  'foreground',
  'muted',
  'muted-foreground',
  'border',
] as const;

export type PaletteTokenName = (typeof PALETTE_TOKEN_NAMES)[number];

export type PalettePairCheck = {
  readonly id: 'primary' | 'body' | 'muted' | 'mutedOnBg';
  readonly foreground: PaletteTokenName;
  readonly background: PaletteTokenName;
  readonly ratio: number;
};

export type PaletteSwatch = {
  readonly name: PaletteTokenName;
  readonly value: string;
  readonly contrastWith?: PaletteTokenName;
  readonly contrastRatio?: number;
};

export type SuggestedPalette = {
  readonly seed: string;
  readonly tokens: Readonly<Record<PaletteTokenName, string>>;
  readonly swatches: readonly PaletteSwatch[];
  readonly pairs: readonly PalettePairCheck[];
};

type Rgb = { readonly r: number; readonly g: number; readonly b: number };
type Hsl = { readonly h: number; readonly s: number; readonly l: number };

const DEFAULT_SEED = '#2563eb';
const WHITE = '#ffffff';
const NEAR_BLACK = '#09090b';
const TARGET_WCAG_CONTRAST = 4.5;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseHex(raw: string): Rgb | undefined {
  const cleaned = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = Number.parseInt((cleaned[0] ?? '0').repeat(2), 16);
    const g = Number.parseInt((cleaned[1] ?? '0').repeat(2), 16);
    const b = Number.parseInt((cleaned[2] ?? '0').repeat(2), 16);
    return { r, g, b };
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    const r = Number.parseInt(cleaned.slice(0, 2), 16);
    const g = Number.parseInt(cleaned.slice(2, 4), 16);
    const b = Number.parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }
  return undefined;
}

function rgbToHex(rgb: Rgb): string {
  const part = (v: number): string => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

/** Normalizes 3-digit or 6-digit hex strings; falls back to default brand blue when invalid. */
export function normalizeHexColor(input: string): string {
  const parsed = parseHex(input);
  return parsed !== undefined ? rgbToHex(parsed) : DEFAULT_SEED;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h / 6) * 360, s: s * 100, l: l * 100 };
}

function hueToChannel(p: number, q: number, tInput: number): number {
  let t = tInput;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToHex({ h, s, l }: Hsl): string {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const gray = ln * 255;
    return rgbToHex({ r: gray, g: gray, b: gray });
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return rgbToHex({
    r: hueToChannel(p, q, hn + 1 / 3) * 255,
    g: hueToChannel(p, q, hn) * 255,
    b: hueToChannel(p, q, hn - 1 / 3) * 255,
  });
}

function linearChannel(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance in `[0, 1]`. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex) ?? parseHex(DEFAULT_SEED);
  if (rgb === undefined) return 0;
  return (
    0.2126 * linearChannel(rgb.r) + 0.7152 * linearChannel(rgb.g) + 0.0722 * linearChannel(rgb.b)
  );
}

/** WCAG 2.1 contrast ratio in `[1, 21]`. */
export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickReadableForeground(bgHex: string): string {
  return contrastRatio(WHITE, bgHex) >= contrastRatio(NEAR_BLACK, bgHex) ? WHITE : NEAR_BLACK;
}

function resolveAccessibleMutedForeground(
  h: number,
  s: number,
  mutedBg: string,
  bg: string,
): string {
  const sat = Math.min(s, 14);
  for (let lightness = 38; lightness >= 10; lightness -= 2) {
    const candidate = hslToHex({ h, s: sat, l: lightness });
    if (
      contrastRatio(candidate, mutedBg) >= TARGET_WCAG_CONTRAST &&
      contrastRatio(candidate, bg) >= TARGET_WCAG_CONTRAST
    ) {
      return candidate;
    }
  }
  return NEAR_BLACK;
}

function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

function buildPaletteSwatches(
  tokens: Readonly<Record<PaletteTokenName, string>>,
  ratios: { readonly primary: number; readonly body: number; readonly muted: number },
): readonly PaletteSwatch[] {
  return [
    {
      name: 'primary',
      value: tokens.primary,
      contrastWith: 'primary-foreground',
      contrastRatio: ratios.primary,
    },
    {
      name: 'primary-foreground',
      value: tokens['primary-foreground'],
      contrastWith: 'primary',
      contrastRatio: ratios.primary,
    },
    {
      name: 'background',
      value: tokens.background,
      contrastWith: 'foreground',
      contrastRatio: ratios.body,
    },
    {
      name: 'foreground',
      value: tokens.foreground,
      contrastWith: 'background',
      contrastRatio: ratios.body,
    },
    {
      name: 'muted',
      value: tokens.muted,
      contrastWith: 'muted-foreground',
      contrastRatio: ratios.muted,
    },
    {
      name: 'muted-foreground',
      value: tokens['muted-foreground'],
      contrastWith: 'muted',
      contrastRatio: ratios.muted,
    },
    { name: 'border', value: tokens.border },
  ];
}

/** Generates a harmonious 7-token theme palette with WCAG >= 4.5:1 text/background pairs. */
export function generatePalette(seedHex: string): SuggestedPalette {
  const primary = normalizeHexColor(seedHex);
  const parsed = parseHex(primary) ?? { r: 37, g: 99, b: 235 };
  const hsl = rgbToHsl(parsed);

  const primaryForeground = pickReadableForeground(primary);
  const background = hslToHex({ h: hsl.h, s: Math.min(hsl.s, 16), l: 99 });
  const foreground = hslToHex({ h: hsl.h, s: Math.min(hsl.s, 24), l: 9 });
  const muted = hslToHex({ h: hsl.h, s: Math.min(hsl.s, 16), l: 94 });
  const mutedForeground = resolveAccessibleMutedForeground(hsl.h, hsl.s, muted, background);
  const border = hslToHex({ h: hsl.h, s: Math.min(hsl.s, 18), l: 86 });

  const tokens: Record<PaletteTokenName, string> = {
    primary,
    'primary-foreground': primaryForeground,
    background,
    foreground,
    muted,
    'muted-foreground': mutedForeground,
    border,
  };

  const primaryRatio = roundRatio(contrastRatio(primaryForeground, primary));
  const bodyRatio = roundRatio(contrastRatio(foreground, background));
  const mutedRatio = roundRatio(contrastRatio(mutedForeground, muted));
  const mutedOnBgRatio = roundRatio(contrastRatio(mutedForeground, background));

  const pairs: readonly PalettePairCheck[] = [
    { id: 'primary', foreground: 'primary-foreground', background: 'primary', ratio: primaryRatio },
    { id: 'body', foreground: 'foreground', background: 'background', ratio: bodyRatio },
    { id: 'muted', foreground: 'muted-foreground', background: 'muted', ratio: mutedRatio },
    {
      id: 'mutedOnBg',
      foreground: 'muted-foreground',
      background: 'background',
      ratio: mutedOnBgRatio,
    },
  ];

  const swatches = buildPaletteSwatches(tokens, {
    primary: primaryRatio,
    body: bodyRatio,
    muted: mutedRatio,
  });

  return { seed: primary, tokens, swatches, pairs };
}
