// Table 8.2 property definitions, matching, and formatting (SPEC-04 section 8).
import type { ThemeInfo } from '../project.ts';
import {
  EXTENDED_PREFIX_PROPERTIES,
  formatExtendedV4Utility,
  matchBgUtility,
  matchObjectUtility,
  matchShadowUtility,
} from './effects-motion-props.ts';
import { PREFIX_MAP, STATIC_STANDALONE } from './property-tables.ts';
import type { ClassValue, PropertyId } from './types.ts';
import { v3ToV4Utility, v4ToV3Utility } from './v3-names.ts';

export const SPACING_FAMILIES: Readonly<
  Record<string, { readonly axis?: string | undefined; readonly all: string }>
> = {
  paddingTop: { axis: 'paddingY', all: 'padding' },
  paddingBottom: { axis: 'paddingY', all: 'padding' },
  paddingLeft: { axis: 'paddingX', all: 'padding' },
  paddingRight: { axis: 'paddingX', all: 'padding' },
  paddingY: { all: 'padding' },
  paddingX: { all: 'padding' },
  marginTop: { axis: 'marginY', all: 'margin' },
  marginBottom: { axis: 'marginY', all: 'margin' },
  marginLeft: { axis: 'marginX', all: 'margin' },
  marginRight: { axis: 'marginX', all: 'margin' },
  marginY: { all: 'margin' },
  marginX: { all: 'margin' },
  top: { axis: 'insetY', all: 'inset' },
  bottom: { axis: 'insetY', all: 'inset' },
  left: { axis: 'insetX', all: 'inset' },
  right: { axis: 'insetX', all: 'inset' },
  insetY: { all: 'inset' },
  insetX: { all: 'inset' },
  gapX: { all: 'gap' },
  gapY: { all: 'gap' },
  borderTopWidth: { all: 'borderWidth' },
  borderRightWidth: { all: 'borderWidth' },
  borderBottomWidth: { all: 'borderWidth' },
  borderLeftWidth: { all: 'borderWidth' },
  borderTopLeftRadius: { all: 'borderRadius' },
  borderTopRightRadius: { all: 'borderRadius' },
  borderBottomRightRadius: { all: 'borderRadius' },
  borderBottomLeftRadius: { all: 'borderRadius' },
};

export const ALL_TO_MEMBERS: Readonly<Record<string, readonly string[]>> = {
  padding: ['paddingX', 'paddingY', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  margin: ['marginX', 'marginY', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
  inset: ['insetX', 'insetY', 'top', 'right', 'bottom', 'left'],
  gap: ['gapX', 'gapY'],
  borderWidth: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
  borderRadius: [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ],
};

export function isArbitrary(val: string): boolean {
  return val.startsWith('[') && val.endsWith(']');
}

export function decodeArbitrary(val: string): string {
  if (isArbitrary(val)) {
    return val.slice(1, -1).replace(/_/g, ' ');
  }
  return val;
}

export function encodeArbitrary(css: string): string {
  return css.replace(/ /g, '_');
}

export function pxToSpacing(px: number, spacingPx = 4): ClassValue {
  if (px === 0) return { kind: 'scale', token: '0' };
  if (px === 1) return { kind: 'scale', token: 'px' };
  const ratio = px / spacingPx;
  if (ratio % 0.5 === 0) {
    return { kind: 'scale', token: String(ratio) };
  }
  return { kind: 'arbitrary', css: `${String(px)}px` };
}

function parseVal(val: string, themeTokens?: readonly { readonly name: string }[]): ClassValue {
  if (isArbitrary(val)) {
    return { kind: 'arbitrary', css: decodeArbitrary(val) };
  }
  if (val.startsWith('(--') && val.endsWith(')')) {
    return { kind: 'theme', name: val.slice(3, -1) };
  }
  if (themeTokens !== undefined) {
    const found = themeTokens.find((t) => t.name === val || `--${t.name}` === val);
    if (found !== undefined) {
      return { kind: 'theme', name: found.name };
    }
  }
  return { kind: 'scale', token: val };
}

function matchText(
  tail: string,
  theme?: ThemeInfo,
): { readonly property: PropertyId; readonly value: ClassValue } | undefined {
  const aligns = ['left', 'center', 'right', 'justify', 'start', 'end'];
  if (aligns.includes(tail)) {
    return { property: 'textAlign', value: { kind: 'keyword', name: tail } };
  }
  const sizes = [
    'xs',
    'sm',
    'base',
    'lg',
    'xl',
    '2xl',
    '3xl',
    '4xl',
    '5xl',
    '6xl',
    '7xl',
    '8xl',
    '9xl',
  ];
  if (sizes.includes(tail)) {
    return { property: 'fontSize', value: { kind: 'scale', token: tail } };
  }
  if (tail.startsWith('(--text-') && tail.endsWith(')')) {
    return { property: 'fontSize', value: { kind: 'theme', name: tail.slice(8, -1) } };
  }
  const themeFontSize = theme?.fontSizes.find(
    (t) => t.name === tail || t.name === `--text-${tail}`,
  );
  if (themeFontSize !== undefined) {
    return { property: 'fontSize', value: { kind: 'theme', name: themeFontSize.name } };
  }
  if (isArbitrary(tail)) {
    const inner = tail.slice(1, -1);
    const isColor =
      inner.startsWith('#') ||
      inner.startsWith('rgb') ||
      inner.startsWith('oklch') ||
      inner.startsWith('hsl');
    if (!isColor) {
      return { property: 'fontSize', value: { kind: 'arbitrary', css: decodeArbitrary(tail) } };
    }
  }
  return { property: 'textColor', value: parseVal(tail, theme?.colors) };
}

const BORDER_SIDES = new Set(['t', 'b', 'l', 'r', 'x', 'y', 's', 'e']);

function matchBorder(
  tail: string,
  isBare: boolean,
  theme?: ThemeInfo,
): { readonly property: PropertyId; readonly value: ClassValue } | undefined {
  if (isBare) {
    return { property: 'borderWidth', value: { kind: 'scale', token: '1' } };
  }
  if (tail === 't') return { property: 'borderTopWidth', value: { kind: 'scale', token: '1' } };
  if (tail === 'r') return { property: 'borderRightWidth', value: { kind: 'scale', token: '1' } };
  if (tail === 'b') return { property: 'borderBottomWidth', value: { kind: 'scale', token: '1' } };
  if (tail === 'l') return { property: 'borderLeftWidth', value: { kind: 'scale', token: '1' } };
  if (tail.startsWith('t-')) return { property: 'borderTopWidth', value: parseVal(tail.slice(2)) };
  if (tail.startsWith('r-'))
    return { property: 'borderRightWidth', value: parseVal(tail.slice(2)) };
  if (tail.startsWith('b-'))
    return { property: 'borderBottomWidth', value: parseVal(tail.slice(2)) };
  if (tail.startsWith('l-')) return { property: 'borderLeftWidth', value: parseVal(tail.slice(2)) };

  const firstSeg = tail.split('-')[0] ?? '';
  if (BORDER_SIDES.has(tail) || BORDER_SIDES.has(firstSeg)) {
    return undefined;
  }
  const styles = ['solid', 'dashed', 'dotted', 'double', 'hidden', 'none'];
  if (styles.includes(tail)) {
    return { property: 'borderStyle', value: { kind: 'keyword', name: tail } };
  }
  const widths = ['0', '2', '4', '8'];
  if (widths.includes(tail)) {
    return { property: 'borderWidth', value: { kind: 'scale', token: tail } };
  }
  if (isArbitrary(tail)) {
    const inner = tail.slice(1, -1);
    const isColor = inner.startsWith('#') || inner.startsWith('rgb') || inner.startsWith('oklch');
    if (!isColor) {
      return { property: 'borderWidth', value: { kind: 'arbitrary', css: decodeArbitrary(tail) } };
    }
  }
  return { property: 'borderColor', value: parseVal(tail, theme?.colors) };
}

const PREFIX_PROPERTIES: readonly [string, PropertyId][] = [
  ['justify-', 'justifyContent'],
  ['items-', 'alignItems'],
  ['self-', 'alignSelf'],
  ['grid-cols-', 'gridCols'],
  ['gap-x-', 'gapX'],
  ['gap-y-', 'gapY'],
  ['gap-', 'gap'],
  ['z-', 'zIndex'],
  ['inset-x-', 'insetX'],
  ['inset-y-', 'insetY'],
  ['inset-', 'inset'],
  ['top-', 'top'],
  ['right-', 'right'],
  ['bottom-', 'bottom'],
  ['left-', 'left'],
  ['min-w-', 'minWidth'],
  ['max-w-', 'maxWidth'],
  ['min-h-', 'minHeight'],
  ['max-h-', 'maxHeight'],
  ['w-', 'width'],
  ['h-', 'height'],
  ['px-', 'paddingX'],
  ['py-', 'paddingY'],
  ['pt-', 'paddingTop'],
  ['pr-', 'paddingRight'],
  ['pb-', 'paddingBottom'],
  ['pl-', 'paddingLeft'],
  ['p-', 'padding'],
  ['mx-', 'marginX'],
  ['my-', 'marginY'],
  ['mt-', 'marginTop'],
  ['mr-', 'marginRight'],
  ['mb-', 'marginBottom'],
  ['ml-', 'marginLeft'],
  ['m-', 'margin'],
  ['font-', 'fontWeight'],
  ['leading-', 'lineHeight'],
  ['tracking-', 'letterSpacing'],
  ['rounded-', 'borderRadius'],
  ['blur-', 'blur'],
  ['ring-', 'ringWidth'],
  ['outline-', 'outline'],
  ['opacity-', 'opacity'],
  ['overflow-', 'overflow'],
  ...EXTENDED_PREFIX_PROPERTIES,
  ['flex-', 'flex'],
];

export function matchProperty(
  rawUtility: string,
  theme?: ThemeInfo,
  major: 3 | 4 = 4,
): { readonly property: PropertyId; readonly value: ClassValue } | undefined {
  const utility = major === 3 ? v3ToV4Utility(rawUtility) : rawUtility;
  const standalone = STATIC_STANDALONE[utility];
  if (standalone !== undefined) return standalone;
  if (utility === 'border') return matchBorder('', true, theme);
  if (utility.startsWith('border-')) return matchBorder(utility.slice(7), false, theme);
  if (utility.startsWith('text-')) return matchText(utility.slice(5), theme);
  if (utility.startsWith('bg-')) return matchBgUtility(utility.slice(3), theme, parseVal);
  if (utility === 'shadow') return matchShadowUtility('', true, theme, parseVal);
  if (utility.startsWith('shadow-'))
    return matchShadowUtility(utility.slice(7), false, theme, parseVal);
  if (utility.startsWith('object-')) return matchObjectUtility(utility.slice(7), parseVal);
  for (const [prefix, prop] of PREFIX_PROPERTIES) {
    if (utility === prefix) {
      return { property: prop, value: { kind: 'keyword', name: utility } };
    }
    if (utility.startsWith(prefix)) {
      const rest = utility.slice(prefix.length);
      return resolvePrefixValue(prop, rest, theme);
    }
  }
  return undefined;
}

function resolveBorderRadiusPrefix(
  rest: string,
  theme?: ThemeInfo,
): { readonly property: PropertyId; readonly value: ClassValue } | undefined {
  const corners: Record<string, PropertyId> = {
    tl: 'borderTopLeftRadius',
    tr: 'borderTopRightRadius',
    br: 'borderBottomRightRadius',
    bl: 'borderBottomLeftRadius',
  };
  for (const [prefix, propId] of Object.entries(corners)) {
    if (rest === prefix) return { property: propId, value: { kind: 'scale', token: 'DEFAULT' } };
    if (rest.startsWith(`${prefix}-`)) {
      return { property: propId, value: parseVal(rest.slice(prefix.length + 1), theme?.radii) };
    }
  }
  const firstSeg = rest.split('-')[0] ?? '';
  const allCorners = ['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br', 's', 'e', 'ss', 'se', 'ee', 'es'];
  if (allCorners.includes(rest) || allCorners.includes(firstSeg)) {
    return undefined;
  }
  return { property: 'borderRadius', value: parseVal(rest, theme?.radii) };
}

function resolvePrefixValue(
  prop: PropertyId,
  rest: string,
  theme?: ThemeInfo,
): { readonly property: PropertyId; readonly value: ClassValue } | undefined {
  if (prop === 'flex') {
    const dirKeywords = ['row', 'col', 'row-reverse', 'col-reverse'];
    if (dirKeywords.includes(rest)) {
      return { property: 'flexDirection', value: { kind: 'keyword', name: rest } };
    }
    const wrapKeywords = ['wrap', 'wrap-reverse', 'nowrap'];
    if (wrapKeywords.includes(rest)) {
      return { property: 'flexWrap', value: { kind: 'keyword', name: rest } };
    }
    return { property: 'flex', value: parseVal(rest) };
  }
  if (prop === 'fontFamily' || prop === 'fontWeight') {
    const families = ['sans', 'serif', 'mono'];
    if (
      families.includes(rest) ||
      rest.startsWith('(--font-') ||
      theme?.fonts.some((f) => f.name === rest)
    ) {
      return { property: 'fontFamily', value: parseVal(rest, theme?.fonts) };
    }
    return { property: 'fontWeight', value: parseVal(rest) };
  }
  if (
    prop === 'backgroundColor' ||
    prop === 'gradientFrom' ||
    prop === 'gradientVia' ||
    prop === 'gradientTo' ||
    prop === 'shadowColor'
  ) {
    return { property: prop, value: parseVal(rest, theme?.colors) };
  }
  if (prop === 'borderRadius') {
    return resolveBorderRadiusPrefix(rest, theme);
  }
  if (prop === 'boxShadow') {
    return { property: prop, value: parseVal(rest, theme?.shadows) };
  }
  return { property: prop, value: parseVal(rest) };
}

function formatV4Utility(property: PropertyId, value: ClassValue): string {
  const valStr =
    value.kind === 'arbitrary'
      ? `[${encodeArbitrary(value.css)}]`
      : value.kind === 'scale'
        ? value.token
        : value.name;
  if (
    ['display', 'position', 'textTransform', 'textDecoration', 'fontStyle', 'visibility'].includes(
      property,
    )
  ) {
    return valStr;
  }
  if (property === 'grow')
    return valStr === '0' ? 'grow-0' : value.kind === 'arbitrary' ? `grow-${valStr}` : 'grow';
  if (property === 'shrink')
    return valStr === '0' ? 'shrink-0' : value.kind === 'arbitrary' ? `shrink-${valStr}` : 'shrink';
  if (property === 'borderWidth')
    return valStr === '1' || valStr === 'DEFAULT' ? 'border' : `border-${valStr}`;
  if (property === 'borderTopWidth')
    return valStr === '1' || valStr === 'DEFAULT' ? 'border-t' : `border-t-${valStr}`;
  if (property === 'borderRightWidth')
    return valStr === '1' || valStr === 'DEFAULT' ? 'border-r' : `border-r-${valStr}`;
  if (property === 'borderBottomWidth')
    return valStr === '1' || valStr === 'DEFAULT' ? 'border-b' : `border-b-${valStr}`;
  if (property === 'borderLeftWidth')
    return valStr === '1' || valStr === 'DEFAULT' ? 'border-l' : `border-l-${valStr}`;
  if (property === 'borderRadius') return valStr === 'DEFAULT' ? 'rounded' : `rounded-${valStr}`;
  if (property === 'borderTopLeftRadius')
    return valStr === 'DEFAULT' ? 'rounded-tl' : `rounded-tl-${valStr}`;
  if (property === 'borderTopRightRadius')
    return valStr === 'DEFAULT' ? 'rounded-tr' : `rounded-tr-${valStr}`;
  if (property === 'borderBottomRightRadius')
    return valStr === 'DEFAULT' ? 'rounded-br' : `rounded-br-${valStr}`;
  if (property === 'borderBottomLeftRadius')
    return valStr === 'DEFAULT' ? 'rounded-bl' : `rounded-bl-${valStr}`;
  if (property === 'boxShadow') return valStr === 'DEFAULT' ? 'shadow' : `shadow-${valStr}`;
  if (property === 'blur') return valStr === 'DEFAULT' ? 'blur' : `blur-${valStr}`;
  if (property === 'ringWidth') return valStr === 'DEFAULT' ? 'ring' : `ring-${valStr}`;
  const extended = formatExtendedV4Utility(property, value, valStr);
  if (extended !== undefined) return extended;
  const prefix = PREFIX_MAP[property];
  return prefix !== undefined ? `${prefix}${valStr}` : `${property}-${valStr}`;
}

export function formatClassValue(
  property: PropertyId,
  value: ClassValue,
  major: 3 | 4 = 4,
): string {
  const v4 = formatV4Utility(property, value);
  return major === 3 ? v4ToV3Utility(v4) : v4;
}
