// Bootstrap 5 utility scale and class parser/generator (SPEC-04 M-ST, R-ST-09, R-ST-10).
export type BootstrapBreakpoint = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export type ParsedUtility = {
  readonly property: string;
  readonly breakpoint?: BootstrapBreakpoint;
  readonly suffix: string;
};

type UtilitySpec = {
  readonly property: string;
  readonly prefix: string;
  readonly responsive: boolean;
  readonly scale: Readonly<Record<string, string>>;
};

const PADDING_SCALE: Readonly<Record<string, string>> = {
  '0': '0',
  '4px': '1',
  '8px': '2',
  '16px': '3',
  '24px': '4',
  '48px': '5',
};

const MARGIN_SCALE: Readonly<Record<string, string>> = {
  ...PADDING_SCALE,
  auto: 'auto',
};

const DISPLAY_VALUES = ['none', 'inline', 'inline-block', 'block', 'grid', 'flex', 'inline-flex'];
const DISPLAY_SCALE: Readonly<Record<string, string>> = Object.fromEntries(
  DISPLAY_VALUES.map((v) => [v, v]),
);

const FLEX_DIR_VALUES = ['row', 'column', 'row-reverse', 'column-reverse'];
const FLEX_DIR_SCALE: Readonly<Record<string, string>> = Object.fromEntries(
  FLEX_DIR_VALUES.map((v) => [v, v]),
);

const JUSTIFY_SCALE: Readonly<Record<string, string>> = {
  'flex-start': 'start',
  'flex-end': 'end',
  center: 'center',
  'space-between': 'between',
  'space-around': 'around',
  'space-evenly': 'evenly',
};

const ALIGN_SCALE: Readonly<Record<string, string>> = {
  'flex-start': 'start',
  'flex-end': 'end',
  center: 'center',
  baseline: 'baseline',
  stretch: 'stretch',
};

const TEXT_ALIGN_SCALE: Readonly<Record<string, string>> = {
  left: 'start',
  start: 'start',
  center: 'center',
  right: 'end',
  end: 'end',
};

const FONT_WEIGHT_SCALE: Readonly<Record<string, string>> = {
  '300': 'light',
  '400': 'normal',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
};

const FONT_SIZE_SCALE: Readonly<Record<string, string>> = {
  '40px': '1',
  '32px': '2',
  '28px': '3',
  '24px': '4',
  '20px': '5',
  '16px': '6',
};

const RADIUS_SCALE: Readonly<Record<string, string>> = {
  '0': '0',
  '4px': '1',
  '6px': '2',
  '8px': '3',
  '16px': '4',
  '32px': '5',
};

const SPECS: readonly UtilitySpec[] = [
  { property: 'paddingTop', prefix: 'pt', responsive: true, scale: PADDING_SCALE },
  { property: 'paddingRight', prefix: 'pe', responsive: true, scale: PADDING_SCALE },
  { property: 'paddingBottom', prefix: 'pb', responsive: true, scale: PADDING_SCALE },
  { property: 'paddingLeft', prefix: 'ps', responsive: true, scale: PADDING_SCALE },
  { property: 'marginTop', prefix: 'mt', responsive: true, scale: MARGIN_SCALE },
  { property: 'marginRight', prefix: 'me', responsive: true, scale: MARGIN_SCALE },
  { property: 'marginBottom', prefix: 'mb', responsive: true, scale: MARGIN_SCALE },
  { property: 'marginLeft', prefix: 'ms', responsive: true, scale: MARGIN_SCALE },
  { property: 'display', prefix: 'd', responsive: true, scale: DISPLAY_SCALE },
  { property: 'flexDirection', prefix: 'flex', responsive: true, scale: FLEX_DIR_SCALE },
  { property: 'justifyContent', prefix: 'justify-content', responsive: true, scale: JUSTIFY_SCALE },
  { property: 'alignItems', prefix: 'align-items', responsive: true, scale: ALIGN_SCALE },
  { property: 'textAlign', prefix: 'text', responsive: true, scale: TEXT_ALIGN_SCALE },
  { property: 'fontWeight', prefix: 'fw', responsive: false, scale: FONT_WEIGHT_SCALE },
  { property: 'fontSize', prefix: 'fs', responsive: false, scale: FONT_SIZE_SCALE },
  { property: 'borderRadius', prefix: 'rounded', responsive: false, scale: RADIUS_SCALE },
];

const GROUPED_SPECS: readonly UtilitySpec[] = [
  { property: 'paddingTop', prefix: 'p', responsive: true, scale: PADDING_SCALE },
  { property: 'paddingLeft', prefix: 'px', responsive: true, scale: PADDING_SCALE },
  { property: 'paddingTop', prefix: 'py', responsive: true, scale: PADDING_SCALE },
  { property: 'marginTop', prefix: 'm', responsive: true, scale: MARGIN_SCALE },
  { property: 'marginLeft', prefix: 'mx', responsive: true, scale: MARGIN_SCALE },
  { property: 'marginTop', prefix: 'my', responsive: true, scale: MARGIN_SCALE },
];

const BREAKPOINTS: readonly BootstrapBreakpoint[] = ['sm', 'md', 'lg', 'xl', 'xxl'];

function isBreakpoint(val: string): val is BootstrapBreakpoint {
  return (BREAKPOINTS as readonly string[]).includes(val);
}

/** Normalizes a CSS value: trims spaces, lowercase, converts `rem` to `px` (16px base), `0px` -> `0`. */
export function normalizeCssValue(raw: string): string {
  const clean = raw.replace(/\s+/g, '').toLowerCase();
  if (clean === '0' || clean === '0px' || clean === '0rem') return '0';
  const remMatch = /^(-?\d+(?:\.\d+)?)rem$/.exec(clean);
  if (remMatch?.[1] !== undefined) {
    const px = Number(remMatch[1]) * 16;
    return px === 0 ? '0' : `${String(px)}px`;
  }
  return clean;
}

function matchAgainstSpec(className: string, spec: UtilitySpec): ParsedUtility | undefined {
  if (!className.startsWith(`${spec.prefix}-`)) return undefined;
  const rest = className.slice(spec.prefix.length + 1);
  const validSuffixes = new Set(Object.values(spec.scale));
  if (validSuffixes.has(rest)) {
    return { property: spec.property, suffix: rest };
  }
  if (!spec.responsive) return undefined;
  const dashIdx = rest.indexOf('-');
  if (dashIdx === -1) return undefined;
  const bp = rest.slice(0, dashIdx);
  const suffix = rest.slice(dashIdx + 1);
  if (!isBreakpoint(bp) || !validSuffixes.has(suffix)) return undefined;
  return { property: spec.property, breakpoint: bp, suffix };
}

/** Parses only single-property utilities (excludes grouped `p-*`, `px-*`, `py-*`, `m-*`, `mx-*`, `my-*`). */
export function parseSingleUtility(className: string): ParsedUtility | undefined {
  for (const spec of SPECS) {
    const parsed = matchAgainstSpec(className, spec);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

/** Parses a Bootstrap 5 utility class (including grouped `p-*`, `px-*`, `py-*`, `m-*`, `mx-*`, `my-*`). */
export function parseUtility(className: string): ParsedUtility | undefined {
  const single = parseSingleUtility(className);
  if (single !== undefined) return single;
  for (const spec of GROUPED_SPECS) {
    const parsed = matchAgainstSpec(className, spec);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

/** Returns the Bootstrap 5 utility class for `(property, cssValue, breakpoint)` when on the scale. */
export function utilityFor(
  property: string,
  cssValue: string,
  breakpoint?: BootstrapBreakpoint,
): string | undefined {
  const spec = SPECS.find((s) => s.property === property);
  if (spec === undefined) return undefined;
  if (breakpoint !== undefined && !spec.responsive) return undefined;
  const suffix = spec.scale[normalizeCssValue(cssValue)];
  if (suffix === undefined) return undefined;
  return breakpoint === undefined
    ? `${spec.prefix}-${suffix}`
    : `${spec.prefix}-${breakpoint}-${suffix}`;
}
