// Normalization for responsive styles (V-29, R-SM-02).
import type { ResponsiveKey, ResponsiveMode } from '../schema/primitives.schema.ts';
import type { StyleProps } from '../schema/style.schema.ts';

const DESKTOP_CASCADE: readonly ResponsiveKey[] = ['xl', 'lg', 'md', 'sm'];
const MOBILE_CASCADE: readonly ResponsiveKey[] = ['sm', 'md', 'lg', 'xl', '2xl'];

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Normalizes responsive styles by removing properties that duplicate values already in effect (V-29).
 */
export function normalizeResponsiveStyle(
  baseStyle: StyleProps | undefined,
  responsive: Partial<Record<ResponsiveKey, StyleProps>> | undefined,
  mode: ResponsiveMode,
): Partial<Record<ResponsiveKey, StyleProps>> | undefined {
  if (responsive === undefined) return undefined;

  const cascadeOrder = mode === 'desktop-first' ? DESKTOP_CASCADE : MOBILE_CASCADE;
  const effective: Record<string, unknown> = { ...(baseStyle ?? {}) };
  const normalized: Partial<Record<ResponsiveKey, StyleProps>> = {};

  for (const key of cascadeOrder) {
    const rawBreakpoint = responsive[key];
    if (rawBreakpoint === undefined) continue;

    const cleanedBreakpoint: Record<string, unknown> = {};
    for (const [prop, val] of Object.entries(rawBreakpoint)) {
      if (val === undefined) continue;
      if (!isDeepEqual(val, effective[prop])) {
        cleanedBreakpoint[prop] = val;
        effective[prop] = val;
      }
    }

    if (Object.keys(cleanedBreakpoint).length > 0) {
      normalized[key] = cleanedBreakpoint;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
