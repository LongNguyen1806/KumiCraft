// Matchers and formatters for K9.7-2 effects, motion, icon stroke, and image properties (TK-6..9, TK-10..17).
import type { ThemeInfo } from '../project.ts';
import type { ClassValue, PropertyId } from './types.ts';

const OBJECT_FIT_KEYWORDS = new Set(['contain', 'cover', 'fill', 'none', 'scale-down']);
const BOX_SHADOW_SCALES = new Set(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none']);
const COLOR_ARBITRARY_RE = /^(#|rgb|rgba|hsl|hsla|oklch|var\()/;

export type ParseValFn = (
  val: string,
  themeTokens?: readonly { readonly name: string }[],
) => ClassValue;

export const EXTENDED_PREFIX_PROPERTIES: readonly [string, PropertyId][] = [
  ['from-', 'gradientFrom'],
  ['via-', 'gradientVia'],
  ['to-', 'gradientTo'],
  ['backdrop-blur-', 'backdropBlur'],
  ['rotate-', 'rotate'],
  ['scale-', 'scale'],
  ['translate-x-', 'translateX'],
  ['translate-y-', 'translateY'],
  ['skew-x-', 'skewX'],
  ['brightness-', 'brightness'],
  ['contrast-', 'contrast'],
  ['grayscale-', 'grayscale'],
  ['mix-blend-', 'mixBlendMode'],
  ['transition-', 'transitionProperty'],
  ['duration-', 'duration'],
  ['ease-', 'ease'],
  ['delay-', 'delay'],
  ['animate-', 'animation'],
  ['aspect-', 'aspectRatio'],
  ['stroke-', 'strokeWidth'],
];

export function matchBgUtility(
  tail: string,
  theme: ThemeInfo | undefined,
  parseVal: ParseValFn,
): { readonly property: PropertyId; readonly value: ClassValue } {
  if (tail === 'none') {
    return { property: 'backgroundImage', value: { kind: 'keyword', name: 'none' } };
  }
  if (tail.startsWith('linear-to-') || tail.startsWith('linear-[')) {
    return {
      property: 'backgroundImage',
      value: tail.startsWith('linear-[')
        ? parseVal(tail.slice('linear-'.length))
        : { kind: 'keyword', name: tail },
    };
  }
  if (tail.startsWith('clip-')) {
    return { property: 'backgroundClip', value: { kind: 'keyword', name: tail.slice(5) } };
  }
  return { property: 'backgroundColor', value: parseVal(tail, theme?.colors) };
}

export function matchShadowUtility(
  tail: string,
  isBare: boolean,
  theme: ThemeInfo | undefined,
  parseVal: ParseValFn,
): { readonly property: PropertyId; readonly value: ClassValue } {
  if (isBare) {
    return { property: 'boxShadow', value: { kind: 'scale', token: 'DEFAULT' } };
  }
  if (BOX_SHADOW_SCALES.has(tail)) {
    return { property: 'boxShadow', value: { kind: 'scale', token: tail } };
  }
  if (tail.startsWith('[') && tail.endsWith(']')) {
    const inner = tail.slice(1, -1);
    const isColor = !inner.includes('_') && COLOR_ARBITRARY_RE.test(inner);
    return {
      property: isColor ? 'shadowColor' : 'boxShadow',
      value: parseVal(tail, theme?.colors),
    };
  }
  return { property: 'shadowColor', value: parseVal(tail, theme?.colors) };
}

export function matchObjectUtility(
  tail: string,
  parseVal: ParseValFn,
): { readonly property: PropertyId; readonly value: ClassValue } {
  if (OBJECT_FIT_KEYWORDS.has(tail)) {
    return { property: 'objectFit', value: { kind: 'keyword', name: tail } };
  }
  return { property: 'objectPosition', value: parseVal(tail) };
}

const SIGNED_TRANSFORM_PREFIXES: Readonly<Record<string, string>> = {
  rotate: 'rotate-',
  translateX: 'translate-x-',
  translateY: 'translate-y-',
  skewX: 'skew-x-',
};

export function formatExtendedV4Utility(
  property: PropertyId,
  value: ClassValue,
  valStr: string,
): string | undefined {
  if (property === 'backgroundImage') {
    if (valStr === 'none') return 'bg-none';
    if (valStr.startsWith('linear-')) return `bg-${valStr}`;
    return `bg-linear-${valStr}`;
  }
  if (property === 'backgroundClip') return `bg-clip-${valStr}`;
  if (property === 'shadowColor') {
    if (value.kind === 'arbitrary' || valStr.includes('/')) return `shadow-${valStr}`;
    return `shadow-${valStr}/50`;
  }
  if (property === 'backdropBlur') {
    return valStr === 'DEFAULT' ? 'backdrop-blur' : `backdrop-blur-${valStr}`;
  }
  if (property === 'grayscale') {
    if (valStr === 'DEFAULT' || valStr === '100%') return 'grayscale';
    if (valStr === '0') return 'grayscale-0';
    return `grayscale-${valStr}`;
  }
  if (property === 'transitionProperty') {
    return valStr === 'DEFAULT' || valStr === 'transition' ? 'transition' : `transition-${valStr}`;
  }
  const signedPrefix = SIGNED_TRANSFORM_PREFIXES[property];
  if (
    signedPrefix !== undefined &&
    value.kind === 'scale' &&
    value.token.startsWith('-') &&
    value.token.length > 1
  ) {
    return `-${signedPrefix}${value.token.slice(1)}`;
  }
  return undefined;
}
