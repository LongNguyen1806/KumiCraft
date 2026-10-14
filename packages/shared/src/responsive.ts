// Breakpoints, responsive modes and the band rule that tells which variant an edit in a frame
// writes (SPEC-03 section 2, ADR-FE-06). Kept from 0.18, where the algorithm was tested.
import { z } from 'zod';

export const RESPONSIVE_KEYS = ['sm', 'md', 'lg', 'xl', '2xl'] as const;
export const ResponsiveKeySchema = z.enum(RESPONSIVE_KEYS);
export type ResponsiveKey = z.infer<typeof ResponsiveKeySchema>;

export const BreakpointSchema = z.enum(['base', ...RESPONSIVE_KEYS]);
export type Breakpoint = z.infer<typeof BreakpointSchema>;

export const ResponsiveModeSchema = z.enum(['desktop-first', 'mobile-first']);
export type ResponsiveMode = z.infer<typeof ResponsiveModeSchema>;

export const InteractionStateSchema = z.enum(['hover', 'focus', 'disabled']);
export type InteractionState = z.infer<typeof InteractionStateSchema>;

/** Minimum width of each responsive key: the Tailwind default breakpoints. */
export const BREAKPOINT_WIDTHS: Readonly<Record<ResponsiveKey, number>> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/**
 * Band of a frame width. `desktop-first`: the smallest key whose breakpoint is above the width, or
 * `base` from the `2xl` breakpoint. `mobile-first`: the largest key at or below the width, or
 * `base` under the `sm` breakpoint.
 */
export function bandOf(
  width: number,
  mode: ResponsiveMode,
  widths: Readonly<Record<ResponsiveKey, number>> = BREAKPOINT_WIDTHS,
): Breakpoint {
  if (mode === 'desktop-first') {
    return RESPONSIVE_KEYS.find((key) => widths[key] > width) ?? 'base';
  }
  return [...RESPONSIVE_KEYS].reverse().find((key) => widths[key] <= width) ?? 'base';
}

/** Key an edit made in a frame of `width` writes: `base` in the band of the primary frame. */
export function editBreakpoint(
  width: number,
  primaryWidth: number,
  mode: ResponsiveMode,
  widths: Readonly<Record<ResponsiveKey, number>> = BREAKPOINT_WIDTHS,
): Breakpoint {
  const band = bandOf(width, mode, widths);
  return band === bandOf(primaryWidth, mode, widths) ? 'base' : band;
}
