// Default design tokens of a new workspace (SPEC-04.1 section 4, M-TK): the Tailwind v4 default
// scale, so exported code feels familiar to developers.
import { type DesignTokens, SCHEMA_VERSION } from '../schema/document.schema.ts';

type Hex = `#${string}`;

const COLORS: readonly (readonly [string, Hex])[] = [
  ['background', '#ffffff'],
  ['surface', '#f8fafc'],
  ['foreground', '#0f172a'],
  ['muted', '#64748b'],
  ['border', '#e2e8f0'],
  ['primary', '#2563eb'],
  ['primary-foreground', '#ffffff'],
  ['secondary', '#f1f5f9'],
  ['secondary-foreground', '#0f172a'],
  ['danger', '#dc2626'],
  ['success', '#16a34a'],
  ['warning', '#d97706'],
];

/** Name = multiple of 4 px (section 4.2). */
const SPACING_STEPS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;

const RADII: readonly (readonly [string, number])[] = [
  ['none', 0],
  ['sm', 4],
  ['md', 6],
  ['lg', 8],
  ['xl', 12],
  ['2xl', 16],
  ['full', 9999],
];

const SHADOWS: readonly (readonly [string, string])[] = [
  ['sm', '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'],
  ['md', '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'],
  ['lg', '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'],
];

/** [name, size px, line height] (section 4.4). */
const FONT_SIZES: readonly (readonly [string, number, number])[] = [
  ['xs', 12, 1.333],
  ['sm', 14, 1.429],
  ['base', 16, 1.5],
  ['lg', 18, 1.556],
  ['xl', 20, 1.4],
  ['2xl', 24, 1.333],
  ['3xl', 30, 1.2],
  ['4xl', 36, 1.111],
  ['5xl', 48, 1],
  ['6xl', 60, 1],
];

const FONT_WEIGHTS: readonly (readonly [string, number])[] = [
  ['normal', 400],
  ['medium', 500],
  ['semibold', 600],
  ['bold', 700],
];

const LINE_HEIGHTS: readonly (readonly [string, number])[] = [
  ['tight', 1.25],
  ['snug', 1.375],
  ['normal', 1.5],
  ['relaxed', 1.625],
];

const FONT_FAMILIES: readonly (readonly [string, readonly string[]])[] = [
  ['sans', ['ui-sans-serif', 'system-ui', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji']],
  ['mono', ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']],
];

/** A fresh copy of the default token set: callers may change it freely. */
export function createDefaultTokens(): DesignTokens {
  return {
    schemaVersion: SCHEMA_VERSION,
    color: Object.fromEntries(COLORS.map(([name, value]) => [name, { value }])),
    spacing: Object.fromEntries(
      SPACING_STEPS.map((step) => [String(step), { value: { px: step * 4 } }]),
    ),
    radius: Object.fromEntries(RADII.map(([name, px]) => [name, { value: { px } }])),
    shadow: Object.fromEntries(SHADOWS.map(([name, value]) => [name, { value }])),
    fontSize: Object.fromEntries(
      FONT_SIZES.map(([name, px, lineHeight]) => [name, { value: { size: { px }, lineHeight } }]),
    ),
    fontWeight: Object.fromEntries(FONT_WEIGHTS.map(([name, value]) => [name, { value }])),
    lineHeight: Object.fromEntries(LINE_HEIGHTS.map(([name, value]) => [name, { value }])),
    fontFamily: Object.fromEntries(
      FONT_FAMILIES.map(([name, value]) => [name, { value: [...value] }]),
    ),
  };
}
