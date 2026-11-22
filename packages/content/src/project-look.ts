// Pure resolver mapping a project's theme tokens and style preset to library block roles (TK-43, TK-69).
import type { ThemeInfo, ThemeToken } from '@kumicraft/shared';

export const LIBRARY_STYLES = ['default', 'minimal', 'soft', 'glass', 'bold'] as const;
export type LibraryStyle = (typeof LIBRARY_STYLES)[number];

export const LOOK_ROLES = [
  'primary',
  'on-primary',
  'surface',
  'surface-muted',
  'text',
  'muted',
  'border',
  'radius',
  'heading',
  'shadow',
  'effect',
] as const;

export type LookRole = (typeof LOOK_ROLES)[number];

export type LookValue = {
  readonly tailwind: string;
  readonly css: string;
};

export type ProjectLook = {
  readonly roles: Readonly<Partial<Record<LookRole, LookValue>>>;
  readonly style?: LibraryStyle;
};

const DEFAULT_VALUES: Readonly<Partial<Record<LookRole, LookValue>>> = {
  primary: { tailwind: 'blue-600', css: '#2563eb' },
  'on-primary': { tailwind: 'white', css: '#ffffff' },
  surface: { tailwind: 'white', css: '#ffffff' },
  'surface-muted': { tailwind: 'gray-50', css: '#f9fafb' },
  text: { tailwind: 'gray-900', css: '#111827' },
  muted: { tailwind: 'gray-600', css: '#4b5563' },
  border: { tailwind: 'gray-200', css: '#e5e7eb' },
  radius: { tailwind: 'lg', css: '8px' },
  shadow: { tailwind: 'shadow-sm', css: '0 1px 2px rgba(0, 0, 0, 0.05)' },
};

const GLASS_EFFECT: LookValue = {
  tailwind: 'backdrop-blur-md',
  css: 'blur(12px)',
};
/** Glass makes the block's own surface and border see-through instead of adding a second color. */
const GLASS_SURFACE_ALPHA = '60';
const GLASS_BORDER_ALPHA = '40';
const GLASS_FALLBACK_BG = `bg-white/${GLASS_SURFACE_ALPHA}`;

const GLASS_CSS_BG = 'rgba(255, 255, 255, 0.6)';

const STYLE_OVERRIDES: Readonly<Record<LibraryStyle, Partial<Record<LookRole, LookValue>>>> = {
  default: {},
  minimal: {
    shadow: { tailwind: 'shadow-none', css: 'none' },
    radius: { tailwind: 'sm', css: '4px' },
  },
  soft: {
    shadow: { tailwind: 'shadow-sm', css: '0 2px 8px rgba(0, 0, 0, 0.08)' },
    radius: { tailwind: 'xl', css: '16px' },
  },
  glass: {
    shadow: { tailwind: 'shadow-lg', css: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
    radius: { tailwind: 'xl', css: '16px' },
    effect: GLASS_EFFECT,
  },
  bold: {
    shadow: { tailwind: 'shadow-xl', css: '0 20px 25px -5px rgba(0, 0, 0, 0.15)' },
    radius: { tailwind: 'lg', css: '8px' },
  },
};

type TokenBucket = 'colors' | 'radii' | 'fonts' | 'shadows';

const ROLE_LOOKUP: Readonly<
  Partial<Record<LookRole, { readonly bucket: TokenBucket; readonly names: readonly string[] }>>
> = {
  primary: { bucket: 'colors', names: ['primary', 'brand', 'accent'] },
  'on-primary': {
    bucket: 'colors',
    names: ['primary-foreground', 'on-primary', 'brand-foreground'],
  },
  surface: { bucket: 'colors', names: ['surface', 'background', 'bg', 'card'] },
  'surface-muted': {
    bucket: 'colors',
    names: ['surface-muted', 'muted', 'secondary', 'subtle'],
  },
  text: { bucket: 'colors', names: ['foreground', 'text', 'ink'] },
  muted: { bucket: 'colors', names: ['muted-foreground', 'text-muted', 'muted'] },
  border: { bucket: 'colors', names: ['border', 'line', 'stroke'] },
  radius: { bucket: 'radii', names: ['radius', 'md', 'DEFAULT', 'lg'] },
  heading: { bucket: 'fonts', names: ['heading', 'display', 'sans'] },
  shadow: { bucket: 'shadows', names: ['card', 'md', 'sm', 'DEFAULT'] },
};

const ROLE_RE = /\{([a-z-]+)\}/g;

function isLookRole(name: string): name is LookRole {
  return (LOOK_ROLES as readonly string[]).includes(name);
}

function findMatchingToken(
  tokens: readonly ThemeToken[],
  candidates: readonly string[],
  ownOnly = false,
): ThemeToken | undefined {
  for (const name of candidates) {
    const match = tokens.find(
      (token) => token.name.toLowerCase() === name.toLowerCase() && (!ownOnly || !token.inherited),
    );
    if (match !== undefined) return match;
  }
  return undefined;
}

function toLookValue(token: ThemeToken): LookValue {
  return {
    tailwind: token.name,
    css:
      token.variable !== undefined && token.variable.length > 0
        ? `var(${token.variable})`
        : token.value,
  };
}

/** Builds semantic role values from a project's theme and optional library style preset. */
export function lookFromTheme(theme: ThemeInfo | undefined, style?: LibraryStyle): ProjectLook {
  const roles: Partial<Record<LookRole, LookValue>> = {};
  if (theme !== undefined) {
    for (const role of LOOK_ROLES) {
      const spec = ROLE_LOOKUP[role];
      if (spec === undefined) continue;
      const ownOnly = spec.bucket === 'radii' || spec.bucket === 'shadows';
      const token = findMatchingToken(theme[spec.bucket], spec.names, ownOnly);
      if (token !== undefined) {
        roles[role] = toLookValue(token);
      }
    }
  }
  if (style !== undefined && style !== 'default') {
    const overrides = STYLE_OVERRIDES[style];
    for (const role of LOOK_ROLES) {
      const next = overrides[role];
      if (next !== undefined) {
        roles[role] = next;
      }
    }
    return { roles, style };
  }
  return { roles };
}

function resolveTailwindToken(token: string, look: ProjectLook): string | undefined {
  if (look.style === 'bold') {
    const primary = look.roles.primary?.tailwind ?? DEFAULT_VALUES.primary?.tailwind;
    if (token === 'bg-{primary}' && primary !== undefined) {
      return `bg-gradient-to-r from-${primary} to-${primary}/80`;
    }
    if (token === 'hover:bg-{primary}/90') {
      return 'hover:opacity-90';
    }
  }

  const matches = Array.from(token.matchAll(ROLE_RE));
  if (matches.length === 0) return token;
  let replaced = token;
  for (const match of matches) {
    const rawRole = match[1];
    if (rawRole === undefined || !isLookRole(rawRole)) continue;
    const val = look.roles[rawRole]?.tailwind ?? DEFAULT_VALUES[rawRole]?.tailwind;
    if (val === undefined) return undefined;
    replaced = replaced.replace(match[0], val);
  }
  if (look.roles.radius?.tailwind === 'DEFAULT' && token.endsWith('-{radius}')) {
    replaced = replaced.replace(/-DEFAULT$/, '');
  }
  return replaced;
}

/**
 * Glass (`{effect}`): one translucent surface and border, so the Inspector sees one background
 * color and a later color change keeps the see-through look.
 */
const GLASS_SURFACES: ReadonlySet<string> = new Set(['bg-{surface}', 'bg-{surface-muted}']);

function applyGlass(parts: readonly string[]): string[] {
  const out = parts.map((part) => {
    if (GLASS_SURFACES.has(part)) return `${part}/${GLASS_SURFACE_ALPHA}`;
    if (part === 'border-{border}') return `${part}/${GLASS_BORDER_ALPHA}`;
    return part;
  });
  const hasSurface = parts.some((part) => GLASS_SURFACES.has(part));
  return hasSurface ? out : [...out, GLASS_FALLBACK_BG];
}

/** Replaces `{role}` tokens inside a Tailwind class list; drops unset roles cleanly. */
export function resolveTailwindRoles(classes: string, look: ProjectLook): string {
  const needsBold = look.style === 'bold' && classes.includes('bg-{primary}');
  if (!classes.includes('{') && !needsBold) return classes;
  const split = classes.trim().split(/\s+/);
  const glass = look.roles.effect !== undefined && split.includes('{effect}');
  const parts = glass ? applyGlass(split) : split;
  const isBoldPrimaryButton =
    needsBold && parts.includes('bg-{primary}') && parts.includes('hover:bg-{primary}/90');
  const activeLook = isBoldPrimaryButton ? look : { roles: look.roles };

  const out: string[] = [];
  for (const part of parts) {
    if (part.length === 0) continue;
    const resolved = resolveTailwindToken(part, activeLook);
    if (resolved !== undefined && resolved.length > 0) {
      out.push(resolved);
    }
  }
  return out.join(' ');
}

function resolveCssValue(rawValue: string, look: ProjectLook): string | undefined {
  const matches = Array.from(rawValue.matchAll(ROLE_RE));
  if (matches.length === 0) return rawValue;
  let resolved = rawValue;
  for (const match of matches) {
    const rawRole = match[1];
    if (rawRole === undefined || !isLookRole(rawRole)) continue;
    const val = look.roles[rawRole]?.css ?? DEFAULT_VALUES[rawRole]?.css;
    if (val === undefined) return undefined;
    resolved = resolved.replace(match[0], val);
  }
  return resolved;
}

/** Replaces `{role}` tokens inside CSS declarations; applies translucent bg with `{effect}`. */
export function resolveCssRoles(
  decls: Readonly<Record<string, string>>,
  look: ProjectLook,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [prop, rawValue] of Object.entries(decls)) {
    const resolved = resolveCssValue(rawValue, look);
    if (resolved !== undefined) {
      result[prop] = resolved;
      if (
        prop === 'backdrop-filter' &&
        rawValue === '{effect}' &&
        look.roles.effect !== undefined
      ) {
        result['background-color'] = GLASS_CSS_BG;
      }
    }
  }
  return result;
}
