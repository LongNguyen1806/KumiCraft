// Project look roles: maps project ThemeInfo tokens to Tailwind classes and CSS values (TK-43).
import type { ThemeInfo, ThemeToken } from '../project.ts';

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
] as const;

export type LookRole = (typeof LOOK_ROLES)[number];

export type LookValue = {
  readonly tailwind: string;
  readonly css: string;
};

export type ProjectLook = {
  readonly roles: Readonly<Partial<Record<LookRole, LookValue>>>;
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
};

const ROLE_LOOKUP: Readonly<
  Record<
    LookRole,
    { readonly bucket: 'colors' | 'radii' | 'fonts'; readonly names: readonly string[] }
  >
> = {
  primary: { bucket: 'colors', names: ['primary', 'brand', 'accent', 'main'] },
  'on-primary': {
    bucket: 'colors',
    names: ['primary-foreground', 'on-primary', 'primary-contrast'],
  },
  surface: { bucket: 'colors', names: ['background', 'surface', 'card', 'paper'] },
  'surface-muted': {
    bucket: 'colors',
    names: ['muted', 'secondary', 'surface-muted', 'subtle-bg'],
  },
  text: { bucket: 'colors', names: ['foreground', 'text', 'ink', 'body', 'heading'] },
  muted: {
    bucket: 'colors',
    names: ['muted-foreground', 'text-muted', 'subtle', 'secondary-foreground'],
  },
  border: { bucket: 'colors', names: ['border', 'line', 'divider', 'outline'] },
  radius: { bucket: 'radii', names: ['DEFAULT', 'radius', 'md', 'lg', 'base'] },
  heading: { bucket: 'fonts', names: ['heading', 'display', 'title'] },
};

const ROLE_RE = /\{([a-zA-Z0-9_-]+)\}/g;

export function isLookRole(name: string): name is LookRole {
  return (LOOK_ROLES as readonly string[]).includes(name);
}

function findMatchingToken(
  tokens: readonly ThemeToken[],
  candidates: readonly string[],
  ownOnly: boolean,
): ThemeToken | undefined {
  // A framework's built-in scale (Tailwind 3 `DEFAULT`/`md`, Bootstrap defaults) is not the
  // project's look: radii must be ones the project set itself, or the default `lg` is lost.
  const pool = ownOnly ? tokens.filter((t) => t.inherited !== true) : tokens;
  for (const candidate of candidates) {
    const target = candidate.toLowerCase();
    const match = pool.find((t) => t.name.toLowerCase() === target);
    if (match !== undefined) return match;
  }
  return undefined;
}

function toLookValue(token: ThemeToken): LookValue {
  const css =
    token.variable !== undefined && token.variable.startsWith('--')
      ? `var(${token.variable})`
      : token.value;
  return { tailwind: token.name, css };
}

/** Derives role values from project theme tokens; omitted roles fall back to built-in defaults. */
export function lookFromTheme(theme: ThemeInfo | undefined): ProjectLook {
  if (theme === undefined) return { roles: {} };
  const roles: Partial<Record<LookRole, LookValue>> = {};
  for (const role of LOOK_ROLES) {
    const spec = ROLE_LOOKUP[role];
    const token = findMatchingToken(theme[spec.bucket], spec.names, spec.bucket === 'radii');
    if (token !== undefined) {
      roles[role] = toLookValue(token);
    }
  }
  return { roles };
}

function resolveTailwindToken(token: string, look: ProjectLook): string | undefined {
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

/** Replaces `{role}` tokens inside a Tailwind class list; drops `font-{heading}` when unset. */
export function resolveTailwindRoles(classes: string, look: ProjectLook): string {
  if (!classes.includes('{')) return classes;
  const parts = classes.trim().split(/\s+/);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length === 0) continue;
    const resolved = resolveTailwindToken(part, look);
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

/** Replaces `{role}` tokens inside CSS declarations; drops declarations using unset `{heading}`. */
export function resolveCssRoles(
  decls: Readonly<Record<string, string>>,
  look: ProjectLook,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [prop, rawValue] of Object.entries(decls)) {
    const resolved = resolveCssValue(rawValue, look);
    if (resolved !== undefined) {
      result[prop] = resolved;
    }
  }
  return result;
}
