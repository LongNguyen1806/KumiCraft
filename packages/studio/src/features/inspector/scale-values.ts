// Properties whose value is an open scale (spec-log #123): the Inspector lets the user type any
// value Tailwind accepts (`mb-13`, `w-1/3`, `p-[13px]`), with the usual values as suggestions,
// instead of a select of a few. A value Tailwind would ignore is not written.
import type { PropertyId } from '@kumicraft/style-tailwind';

type ScaleKind = 'spacing' | 'size' | 'border' | 'zIndex' | 'gridCols' | 'opacity' | 'named';

const KINDS: Readonly<Partial<Record<PropertyId, ScaleKind>>> = {
  padding: 'spacing',
  paddingTop: 'spacing',
  paddingRight: 'spacing',
  paddingBottom: 'spacing',
  paddingLeft: 'spacing',
  margin: 'spacing',
  marginTop: 'spacing',
  marginRight: 'spacing',
  marginBottom: 'spacing',
  marginLeft: 'spacing',
  gap: 'spacing',
  width: 'size',
  height: 'size',
  minWidth: 'size',
  maxWidth: 'size',
  minHeight: 'size',
  maxHeight: 'size',
  borderWidth: 'border',
  borderTopWidth: 'border',
  borderRightWidth: 'border',
  borderBottomWidth: 'border',
  borderLeftWidth: 'border',
  zIndex: 'zIndex',
  gridCols: 'gridCols',
  opacity: 'opacity',
  fontSize: 'named',
  lineHeight: 'named',
  letterSpacing: 'named',
  borderRadius: 'named',
  borderTopLeftRadius: 'named',
  borderTopRightRadius: 'named',
  borderBottomRightRadius: 'named',
  borderBottomLeftRadius: 'named',
};

/** Whether a property takes a typed value with suggestions rather than a fixed list. */
export function isOpenScale(property: PropertyId): boolean {
  return KINDS[property] !== undefined;
}

// Tailwind 3 has a fixed spacing scale; Tailwind 4 takes any multiple of 0.25.
const V3_SPACING = new Set(
  '0 0.5 1 1.5 2 2.5 3 3.5 4 5 6 7 8 9 10 11 12 14 16 20 24 28 32 36 40 44 48 52 56 60 64 72 80 96'.split(
    ' ',
  ),
);
const SIZE_WORDS = new Set([
  'auto',
  'full',
  'screen',
  'min',
  'max',
  'fit',
  'none',
  'prose',
  'svh',
  'lvh',
  'dvh',
  'svw',
  'lvw',
  'dvw',
  ...'xs sm md lg xl 2xl 3xl 4xl 5xl 6xl 7xl'.split(' '),
]);
const V3_FRACTION_DENOMINATORS = new Set([2, 3, 4, 5, 6, 12]);
/** A CSS length or a CSS function, for `[…]` on a property that needs a size. */
const CSS_LENGTH =
  /^(-?\d*\.?\d+(px|rem|em|%|vh|vw|dvh|svh|lvh|dvw|svw|lvw|ch|ex|vmin|vmax|pt|pc|cm|mm|in)|0|(calc|var|min|max|clamp)\(.+\))$/;
const LENGTH_KINDS = new Set<ScaleKind>(['spacing', 'size', 'border']);

const isNumber = (value: string) => /^\d+(\.\d+)?$/.test(value);
const isInteger = (value: string) => /^\d+$/.test(value);

function validArbitrary(kind: ScaleKind, value: string): boolean {
  const inner = value.slice(1, -1);
  if (inner === '' || /\s/.test(inner)) return false;
  return LENGTH_KINDS.has(kind) ? CSS_LENGTH.test(inner) : true;
}

function validSpacing(value: string, major: 3 | 4): boolean {
  if (value === 'px') return true;
  if (!isNumber(value)) return false;
  return major === 3 ? V3_SPACING.has(value) : Number.isInteger(Number(value) * 4);
}

function validFraction(value: string, major: 3 | 4): boolean {
  const [, topText, bottomText] = /^(\d+)\/(\d+)$/.exec(value) ?? [];
  if (topText === undefined || bottomText === undefined) return false;
  const top = Number(topText);
  const bottom = Number(bottomText);
  if (bottom === 0) return false;
  return major === 4 || (V3_FRACTION_DENOMINATORS.has(bottom) && top < bottom);
}

function validByKind(kind: ScaleKind, value: string, major: 3 | 4): boolean {
  switch (kind) {
    case 'spacing':
      return validSpacing(value, major);
    case 'size':
      return SIZE_WORDS.has(value) || validSpacing(value, major) || validFraction(value, major);
    case 'border':
      return isInteger(value) && (major === 4 || ['0', '2', '4', '8'].includes(value));
    case 'zIndex':
      return (
        isInteger(value) && (major === 4 || ['0', '10', '20', '30', '40', '50'].includes(value))
      );
    case 'gridCols':
      return isInteger(value) && Number(value) > 0 && (major === 4 || Number(value) <= 12);
    case 'opacity':
      return isInteger(value) && Number(value) <= 100 && (major === 4 || Number(value) % 5 === 0);
    case 'named':
      return false;
  }
}

/**
 * Whether a typed value can be written: empty (removes the class), one of the suggestions, a
 * `[…]` value, or a value of the property's Tailwind scale for the project's major version.
 */
export function isValidScaleValue(
  property: PropertyId,
  raw: string,
  suggestions: readonly string[],
  major: 3 | 4,
): boolean {
  const value = raw.trim();
  if (value === '' || suggestions.includes(value)) return true;
  const kind = KINDS[property];
  if (kind === undefined) return true;
  if (value.startsWith('[') && value.endsWith(']')) return validArbitrary(kind, value);
  if (kind === 'named' && property === 'lineHeight') {
    return isNumber(value) && (major === 4 || (Number(value) >= 3 && Number(value) <= 10));
  }
  return validByKind(kind, value, major);
}
