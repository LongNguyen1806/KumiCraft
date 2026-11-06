// Breakpoints, responsive modes and the band rule that tells which variant an edit in a frame
// writes (SPEC-03 section 2, ADR-FE-06). Kept from 0.18, where the algorithm was tested.
import { z } from 'zod';

import type { ThemeInfo } from './project.ts';

export const RESPONSIVE_KEYS = ['sm', 'md', 'lg', 'xl', '2xl'] as const;
export const ResponsiveKeySchema = z.string().regex(/^[a-z0-9]{1,10}$/);
export type ResponsiveKey = string;

export const BreakpointSchema = z.string().regex(/^[a-z0-9]{1,10}$/);
export type Breakpoint = string;

export const ResponsiveModeSchema = z.enum(['desktop-first', 'mobile-first']);
export type ResponsiveMode = z.infer<typeof ResponsiveModeSchema>;

export const InteractionStateSchema = z.enum(['hover', 'focus', 'disabled']);
export type InteractionState = z.infer<typeof InteractionStateSchema>;

/** Minimum width of each responsive key: the Tailwind default breakpoints. */
export const BREAKPOINT_WIDTHS: Readonly<Record<string, number>> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export type ProjectBreakpoint = { readonly key: string; readonly min: number };

export function parseBreakpointValue(val: string): number | undefined {
  const trimmed = val.trim();
  if (trimmed.endsWith('rem') || trimmed.endsWith('em')) {
    const num = parseFloat(trimmed);
    return Number.isFinite(num) && num > 0 ? Math.round(num * 16) : undefined;
  }
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function projectBreakpoints(theme?: ThemeInfo): readonly ProjectBreakpoint[] {
  const map = new Map<string, number>();
  for (const k of RESPONSIVE_KEYS) {
    map.set(k, BREAKPOINT_WIDTHS[k] ?? 0);
  }
  if (theme?.breakpoints) {
    for (const b of theme.breakpoints) {
      const cleanKey = b.name.replace(/^--breakpoint-/, '');
      const parsed = parseBreakpointValue(b.value);
      if (parsed !== undefined) {
        map.set(cleanKey, parsed);
      }
    }
  }
  return Array.from(map.entries())
    .map(([key, min]) => ({ key, min }))
    .sort((a, b) => a.min - b.min);
}

export function isProjectBreakpointList(
  val: readonly ProjectBreakpoint[] | Readonly<Record<string, number>>,
): val is readonly ProjectBreakpoint[] {
  return Array.isArray(val);
}

/**
 * Band of a frame width. `desktop-first`: the smallest key whose breakpoint is above the width, or
 * `base` from the largest breakpoint. `mobile-first`: the largest key at or below the width, or
 * `base` under the smallest breakpoint.
 */
export function bandOf(
  width: number,
  mode: ResponsiveMode,
  breakpoints?: readonly ProjectBreakpoint[] | Readonly<Record<string, number>>,
): Breakpoint {
  let list: readonly ProjectBreakpoint[];
  if (breakpoints === undefined) {
    list = projectBreakpoints();
  } else if (isProjectBreakpointList(breakpoints)) {
    list = breakpoints;
  } else {
    const items: ProjectBreakpoint[] = [];
    for (const key of Object.keys(breakpoints)) {
      const min = breakpoints[key];
      if (typeof min === 'number') {
        items.push({ key, min });
      }
    }
    list = items.sort((a, b) => a.min - b.min);
  }

  if (mode === 'desktop-first') {
    return list.find((b) => b.min > width)?.key ?? 'base';
  }
  return [...list].reverse().find((b) => b.min <= width)?.key ?? 'base';
}

/** Key an edit made in a frame of `width` writes: `base` in the band of the primary frame. */
export function editBreakpoint(
  width: number,
  primaryWidth: number,
  mode: ResponsiveMode,
  breakpoints?: readonly ProjectBreakpoint[] | Readonly<Record<string, number>>,
): Breakpoint {
  const band = bandOf(width, mode, breakpoints);
  return band === bandOf(primaryWidth, mode, breakpoints) ? 'base' : band;
}
