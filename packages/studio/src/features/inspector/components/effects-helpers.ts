// Pure helpers and option tables for Inspector Effects controls (gradient, glow, backdrop blur, transform, filter) (K9.7-2 TK-12..14).
import {
  BREAKPOINT_WIDTHS,
  type ClassContext,
  type ClassToken,
  type ClassValue,
  extractCompositeSubValue,
  type PropertyId,
  readValue,
  type Scope,
  type StyleReading,
} from '@kumicraft/shared';

const DEFAULT_READ_CTX: ClassContext = {
  theme: { colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] },
  mode: 'desktop-first',
  breakpoints: BREAKPOINT_WIDTHS,
};

export const GRADIENT_DIRS = [
  { tw: 'linear-to-r', css: 'to right', label: '→' },
  { tw: 'linear-to-br', css: 'to bottom right', label: '↘' },
  { tw: 'linear-to-b', css: 'to bottom', label: '↓' },
  { tw: 'linear-to-bl', css: 'to bottom left', label: '↙' },
  { tw: 'linear-to-l', css: 'to left', label: '←' },
  { tw: 'linear-to-tl', css: 'to top left', label: '↖' },
  { tw: 'linear-to-t', css: 'to top', label: '↑' },
  { tw: 'linear-to-tr', css: 'to top right', label: '↗' },
] as const;

export const GRADIENT_COLORS = [
  { id: 'blue-500', hex: '#3b82f6' },
  { id: 'indigo-500', hex: '#6366f1' },
  { id: 'purple-500', hex: '#a855f7' },
  { id: 'pink-500', hex: '#ec4899' },
  { id: 'rose-500', hex: '#f43f5e' },
  { id: 'amber-500', hex: '#f59e0b' },
  { id: 'emerald-500', hex: '#10b981' },
  { id: 'cyan-500', hex: '#06b6d4' },
  { id: 'slate-900', hex: '#0f172a' },
  { id: 'white', hex: '#ffffff' },
] as const;

export const BACKDROP_BLUR_OPTIONS = [
  { tw: 'none', css: '0px' },
  { tw: 'sm', css: '4px' },
  { tw: 'md', css: '12px' },
  { tw: 'lg', css: '16px' },
  { tw: 'xl', css: '24px' },
] as const;

export const TRANSFORM_FIELDS = [
  {
    prop: 'rotate' as const,
    labelKey: 'inspector.fields.rotate',
    items: [
      { tw: '-45', css: '-45deg' },
      { tw: '-12', css: '-12deg' },
      { tw: '0', css: '0deg' },
      { tw: '6', css: '6deg' },
      { tw: '12', css: '12deg' },
      { tw: '45', css: '45deg' },
      { tw: '90', css: '90deg' },
    ],
  },
  {
    prop: 'scale' as const,
    labelKey: 'inspector.fields.scale',
    items: [
      { tw: '75', css: '0.75' },
      { tw: '90', css: '0.9' },
      { tw: '95', css: '0.95' },
      { tw: '100', css: '1' },
      { tw: '105', css: '1.05' },
      { tw: '110', css: '1.1' },
      { tw: '125', css: '1.25' },
    ],
  },
  {
    prop: 'translateX' as const,
    labelKey: 'inspector.fields.translateX',
    items: [
      { tw: '-4', css: '-16px' },
      { tw: '-2', css: '-8px' },
      { tw: '0', css: '0px' },
      { tw: '2', css: '8px' },
      { tw: '4', css: '16px' },
      { tw: '8', css: '32px' },
    ],
  },
  {
    prop: 'translateY' as const,
    labelKey: 'inspector.fields.translateY',
    items: [
      { tw: '-4', css: '-16px' },
      { tw: '-2', css: '-8px' },
      { tw: '0', css: '0px' },
      { tw: '2', css: '8px' },
      { tw: '4', css: '16px' },
      { tw: '8', css: '32px' },
    ],
  },
  {
    prop: 'skewX' as const,
    labelKey: 'inspector.fields.skewX',
    items: [
      { tw: '-12', css: '-12deg' },
      { tw: '-6', css: '-6deg' },
      { tw: '0', css: '0deg' },
      { tw: '6', css: '6deg' },
      { tw: '12', css: '12deg' },
    ],
  },
] as const;

export const FILTER_FIELDS = [
  {
    prop: 'blur' as const,
    labelKey: 'inspector.fields.blur',
    items: [
      { tw: 'none', css: '0px' },
      { tw: 'sm', css: '4px' },
      { tw: 'md', css: '12px' },
      { tw: 'lg', css: '16px' },
    ],
  },
  {
    prop: 'brightness' as const,
    labelKey: 'inspector.fields.brightness',
    items: [
      { tw: '50', css: '0.5' },
      { tw: '75', css: '0.75' },
      { tw: '100', css: '1' },
      { tw: '125', css: '1.25' },
      { tw: '150', css: '1.5' },
    ],
  },
  {
    prop: 'contrast' as const,
    labelKey: 'inspector.fields.contrast',
    items: [
      { tw: '75', css: '0.75' },
      { tw: '100', css: '1' },
      { tw: '125', css: '1.25' },
      { tw: '150', css: '1.5' },
    ],
  },
  {
    prop: 'grayscale' as const,
    labelKey: 'inspector.fields.grayscale',
    items: [
      { tw: '0', css: '0' },
      { tw: '100', css: '1' },
    ],
  },
] as const;

export const MIX_BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
] as const;

export const GLOW_TW_SHADOW = '0_0_24px_rgba(59,130,246,0.45)';
export const GLOW_CSS_SHADOW = '0 0 24px rgba(59, 130, 246, 0.45)';

export function readTwTokenStr(
  tokens: readonly ClassToken[],
  scope: Scope,
  prop: PropertyId,
  ctx: ClassContext = DEFAULT_READ_CTX,
): string {
  const width = scope.breakpoint === 'base' ? 1440 : (ctx.breakpoints[scope.breakpoint] ?? 1440);
  const { value: val } = readValue(tokens, prop, { width, state: scope.state }, ctx);
  if (val === undefined) return '';
  if (val.kind === 'keyword') return val.name;
  if (val.kind === 'scale') return val.token;
  if (val.kind === 'theme') return val.name;
  return `[${val.css}]`;
}

export function readCssPropVal(reading: StyleReading | undefined, propId: string): string {
  const raw = reading?.properties.find((p) => p.id === propId)?.value?.css ?? '';
  if (raw === '') return '';
  return extractCompositeSubValue(propId, raw) ?? raw;
}

export function colorToTwValue(tokenOrHex: string): ClassValue {
  if (tokenOrHex.startsWith('#')) {
    return { kind: 'arbitrary', css: tokenOrHex };
  }
  return { kind: 'scale', token: tokenOrHex };
}

export function colorToHex(tokenOrHex: string): string {
  if (tokenOrHex.startsWith('#')) return tokenOrHex;
  return GRADIENT_COLORS.find((c) => c.id === tokenOrHex)?.hex ?? '#3b82f6';
}

export function buildCssLinearGradient(
  dirCss: string,
  fromColor: string,
  viaColor: string,
  toColor: string,
): string {
  const stops = [colorToHex(fromColor)];
  if (viaColor !== '' && viaColor !== 'none') stops.push(colorToHex(viaColor));
  stops.push(colorToHex(toColor));
  return `linear-gradient(${dirCss}, ${stops.join(', ')})`;
}

export function parseCssLinearGradient(raw: string): {
  readonly enabled: boolean;
  readonly dirCss: string;
  readonly from: string;
  readonly via: string;
  readonly to: string;
} {
  const match = raw.match(/^linear-gradient\(\s*([^,]+)\s*,\s*(.+)\s*\)$/);
  if (!match) {
    return { enabled: false, dirCss: 'to right', from: '#3b82f6', via: '', to: '#a855f7' };
  }
  const dirCss = (match[1] ?? 'to right').trim();
  const rest = match[2] ?? '';
  const parts = rest.split(/\s*,\s*(?![^()]*\))/).map((s) => s.trim());
  const from = parts[0] ?? '#3b82f6';
  const via = parts.length >= 3 ? (parts[1] ?? '') : '';
  const to = parts.length >= 3 ? (parts[2] ?? '#a855f7') : (parts[1] ?? '#a855f7');
  return { enabled: true, dirCss, from, via, to };
}
