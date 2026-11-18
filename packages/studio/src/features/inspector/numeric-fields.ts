// The Inspector's number fields with a slider (the owner, 2026-11-18: a list of a few values let
// nobody set 15° or 400ms). Each field has the slider's range, the limits a typed value may reach,
// its unit, and how its value reads from and writes to Tailwind 3, Tailwind 4 and plain CSS.
import type { ClassValue, PropertyId } from '@kumicraft/shared';

export type NumberUnit = 'deg' | '%' | 'px' | 'ms';

export type NumericField = {
  readonly prop: PropertyId;
  readonly unit: NumberUnit;
  /** The slider's ends. */
  readonly min: number;
  readonly max: number;
  /** What a typed value may reach; outside is an error, never clamped quietly. */
  readonly lo: number;
  readonly hi: number;
  /** Where the slider rests while the code sets nothing (no rotation, 100% brightness). */
  readonly rest: number;
};

const field = (
  prop: PropertyId,
  unit: NumberUnit,
  range: readonly [number, number, number, number],
  rest = 0,
): NumericField => ({ prop, unit, min: range[0], max: range[1], lo: range[2], hi: range[3], rest });

export const NUMERIC_FIELDS = {
  rotate: field('rotate', 'deg', [-180, 180, -360, 360]),
  scale: field('scale', '%', [0, 200, 0, 500], 100),
  translateX: field('translateX', 'px', [-100, 100, -2000, 2000]),
  translateY: field('translateY', 'px', [-100, 100, -2000, 2000]),
  skewX: field('skewX', 'deg', [-45, 45, -89, 89]),
  blur: field('blur', 'px', [0, 40, 0, 200]),
  backdropBlur: field('backdropBlur', 'px', [0, 40, 0, 200]),
  brightness: field('brightness', '%', [0, 200, 0, 500], 100),
  contrast: field('contrast', '%', [0, 200, 0, 500], 100),
  grayscale: field('grayscale', '%', [0, 100, 0, 100]),
  duration: field('duration', 'ms', [0, 2000, 0, 10_000]),
  delay: field('delay', 'ms', [0, 2000, 0, 10_000]),
} as const satisfies Readonly<Record<string, NumericField>>;

/** The Reveal's own props: plain numbers in the JSX (`delay={150}`), not classes. */
export const REVEAL_FIELDS = {
  delay: { ...field('delay', 'ms', [0, 1000, 0, 5000]) },
  stagger: { ...field('delay', 'ms', [0, 500, 0, 5000]) },
} as const;

// ── Tailwind names (v3 and v4 differ: v4 takes any number, v3 has a fixed list) ───────────────

const BLUR_V4: Readonly<Record<string, number>> = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 40,
  '3xl': 64,
};
const BLUR_V3: Readonly<Record<string, number>> = {
  none: 0,
  sm: 4,
  DEFAULT: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 40,
  '3xl': 64,
};
const V3_NAMED: Readonly<Partial<Record<PropertyId, readonly number[]>>> = {
  rotate: [0, 1, 2, 3, 6, 12, 45, 90, 180],
  skewX: [0, 1, 2, 3, 6, 12],
  scale: [0, 50, 75, 90, 95, 100, 105, 110, 125, 150],
  brightness: [0, 50, 75, 90, 95, 100, 105, 110, 125, 150, 200],
  contrast: [0, 50, 75, 100, 125, 150, 200],
  duration: [0, 75, 100, 150, 200, 300, 500, 700, 1000],
  delay: [0, 75, 100, 150, 200, 300, 500, 700, 1000],
};
const V3_SPACING = new Set([
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64, 72, 80, 96,
]);
/** Properties whose number is a fraction in CSS (`scale: 1.5`, `brightness(1.5)`) and % here. */
const FRACTION_PROPS = new Set<PropertyId>(['scale', 'brightness', 'contrast', 'grayscale']);
const SIGNED = new Set<PropertyId>(['rotate', 'skewX', 'translateX', 'translateY']);

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A CSS length, angle or time as this field's unit; undefined when it is not one. */
function fromCssText(f: NumericField, text: string): number | undefined {
  const m = /^(-?\d*\.?\d+)(deg|px|rem|ms|s|%)?$/.exec(text.trim()) ?? undefined;
  if (m === undefined) return undefined;
  const n = Number(m[1]);
  const unit = m[2] ?? '';
  if (f.unit === '%') return unit === '%' ? n : FRACTION_PROPS.has(f.prop) ? round(n * 100) : n;
  if (f.unit === 'px') return unit === 'rem' ? n * 16 : unit === 'px' || n === 0 ? n : undefined;
  if (f.unit === 'ms') return unit === 's' ? n * 1000 : unit === 'ms' || n === 0 ? n : undefined;
  return unit === 'deg' || n === 0 ? n : undefined;
}

/** The number a Tailwind value of the field stands for; undefined when it is not a number. */
export function numberFromTw(f: NumericField, value: string): number | undefined {
  if (value === '') return undefined;
  if (value.startsWith('[') && value.endsWith(']')) return fromCssText(f, value.slice(1, -1));
  if (f.prop === 'blur' || f.prop === 'backdropBlur') return BLUR_V4[value] ?? BLUR_V3[value];
  if (f.prop === 'grayscale' && value === 'DEFAULT') return 100;
  if (f.prop === 'translateX' || f.prop === 'translateY') {
    if (value === 'px' || value === '-px') return value === 'px' ? 1 : -1;
    return NUMBER_RE.test(value) ? Number(value) * 4 : undefined;
  }
  return NUMBER_RE.test(value) ? Number(value) : undefined;
}

/** The Tailwind value that writes `n`: the named class when there is one, else `[…]`. */
export function twValueOf(f: NumericField, n: number, major: 3 | 4): ClassValue {
  const arbitrary = (): ClassValue => ({ kind: 'arbitrary', css: cssValueOf(f, n) });
  const scale = (token: string): ClassValue => ({ kind: 'scale', token });
  if (f.prop === 'blur' || f.prop === 'backdropBlur') {
    const names = major === 3 ? BLUR_V3 : BLUR_V4;
    const name = Object.entries(names).find(([, px]) => px === n)?.[0];
    return name !== undefined ? scale(name) : arbitrary();
  }
  if (f.prop === 'grayscale' && (n === 0 || n === 100)) return scale(n === 0 ? '0' : 'DEFAULT');
  if (f.prop === 'translateX' || f.prop === 'translateY') {
    const units = Math.abs(n) / 4;
    const fits = major === 4 ? Number.isInteger(n) : V3_SPACING.has(units);
    if (!fits) return arbitrary();
    return scale(`${n < 0 ? '-' : ''}${n === 1 || n === -1 ? 'px' : String(units)}`);
  }
  const fits =
    major === 4 ? Number.isInteger(n) : (V3_NAMED[f.prop]?.includes(Math.abs(n)) ?? false);
  if (!fits || (n < 0 && !SIGNED.has(f.prop))) return arbitrary();
  return scale(String(n));
}

/** The CSS text that writes `n` (`15deg`, `1.5`, `12px`, `400ms`). */
export function cssValueOf(f: NumericField, n: number): string {
  if (f.unit === '%') return FRACTION_PROPS.has(f.prop) ? String(round(n / 100)) : `${String(n)}%`;
  return `${String(n)}${f.unit}`;
}

/** The number a plain-CSS value of the field stands for. */
export function numberFromCss(f: NumericField, css: string): number | undefined {
  const inner = /^[a-z-]+\((.+)\)$/.exec(css.trim())?.[1] ?? css;
  return fromCssText(f, inner);
}

// ── What the user types ─────────────────────────────────────────────────────────────────────

export type TypedNumber =
  | { readonly kind: 'empty' }
  | { readonly kind: 'value'; readonly value: number }
  | {
      readonly kind: 'error';
      readonly reason: 'notNumber' | 'notInteger' | 'tooSmall' | 'tooBig';
      readonly limit?: number;
    };

const TYPED_UNITS: Readonly<Record<NumberUnit, readonly string[]>> = {
  deg: ['deg', '°'],
  '%': ['%'],
  px: ['px'],
  ms: ['ms'],
};

/** Reads a typed value: a whole number, a comma or a dot, and the field's own unit at the end. */
export function parseTyped(f: NumericField, raw: string): TypedNumber {
  let text = raw.trim().replace(',', '.').replace(/\s+/g, '');
  if (text === '') return { kind: 'empty' };
  for (const unit of TYPED_UNITS[f.unit]) {
    if (text.toLowerCase().endsWith(unit)) {
      text = text.slice(0, -unit.length);
      break;
    }
  }
  if (!NUMBER_RE.test(text)) return { kind: 'error', reason: 'notNumber' };
  const value = Number(text);
  if (!Number.isInteger(value)) return { kind: 'error', reason: 'notInteger' };
  if (value < f.lo) return { kind: 'error', reason: 'tooSmall', limit: f.lo };
  if (value > f.hi) return { kind: 'error', reason: 'tooBig', limit: f.hi };
  return { kind: 'value', value };
}

/** The value one arrow press reaches: one step, ten with Shift, kept inside the typing limits. */
export function steppedValue(f: NumericField, from: number | undefined, up: boolean, big: boolean) {
  const next = (from ?? f.rest) + (up ? 1 : -1) * (big ? 10 : 1);
  return Math.min(f.hi, Math.max(f.lo, next));
}

// ── The look while dragging, before anything is written ─────────────────────────────────────

export type PreviewDeclaration = { readonly property: string; readonly value: string };

const TRANSFORM_PROPS = ['translateX', 'translateY', 'rotate', 'skewX', 'scale'] as const;
const FILTER_PROPS = ['blur', 'brightness', 'contrast', 'grayscale'] as const;

/**
 * The inline styles that show the transform or filter the fields hold now, `values` holding the
 * dragged one. The whole transform (or filter) is written at once, and Tailwind 4's own
 * `rotate`/`scale`/`translate` are set to none, so it looks the same in Tailwind 3, 4 and CSS.
 */
export function previewDeclarations(
  prop: PropertyId,
  values: Readonly<Partial<Record<PropertyId, number>>>,
): readonly PreviewDeclaration[] {
  const v = (p: PropertyId, rest = 0) => values[p] ?? rest;
  if ((TRANSFORM_PROPS as readonly PropertyId[]).includes(prop)) {
    const transform = [
      `translate(${String(v('translateX'))}px, ${String(v('translateY'))}px)`,
      `rotate(${String(v('rotate'))}deg)`,
      `skewX(${String(v('skewX'))}deg)`,
      `scale(${String(v('scale', 100) / 100)})`,
    ].join(' ');
    return [
      { property: 'transform', value: transform },
      { property: 'translate', value: 'none' },
      { property: 'rotate', value: 'none' },
      { property: 'scale', value: 'none' },
    ];
  }
  if ((FILTER_PROPS as readonly PropertyId[]).includes(prop)) {
    const filter = [
      `blur(${String(v('blur'))}px)`,
      `brightness(${String(v('brightness', 100))}%)`,
      `contrast(${String(v('contrast', 100))}%)`,
      `grayscale(${String(v('grayscale'))}%)`,
    ].join(' ');
    return [{ property: 'filter', value: filter }];
  }
  if (prop === 'backdropBlur') {
    return [{ property: 'backdrop-filter', value: `blur(${String(v('backdropBlur'))}px)` }];
  }
  return [];
}
