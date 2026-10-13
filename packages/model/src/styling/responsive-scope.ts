// Breakpoint resolution and effective style computation for responsive design (SPEC-03 sections 2.2, 2.2a; SPEC-04.1 section 11.1).
import type { StyleScope } from '../operations/operation.schema.ts';
import type { DesignNode } from '../schema/node.schema.ts';
import {
  type Breakpoint,
  BREAKPOINT_WIDTHS,
  type InteractionState,
  type ResponsiveKey,
  type ResponsiveMode,
} from '../schema/primitives.schema.ts';
import type { StyleProps } from '../schema/style.schema.ts';

export type { Breakpoint };
export const BREAKPOINT_MIN: Readonly<Record<ResponsiveKey, number>> = BREAKPOINT_WIDTHS;

const ASCENDING_KEYS: readonly ResponsiveKey[] = ['sm', 'md', 'lg', 'xl', '2xl'];
const DESKTOP_CASCADE: readonly ResponsiveKey[] = ['2xl', 'xl', 'lg', 'md', 'sm'];
const MOBILE_CASCADE: readonly ResponsiveKey[] = ['sm', 'md', 'lg', 'xl', '2xl'];

export function bandOf(width: number, mode: ResponsiveMode): Breakpoint {
  if (mode === 'desktop-first') {
    for (const key of ASCENDING_KEYS) {
      if (BREAKPOINT_MIN[key] > width) return key;
    }
    return 'base';
  }

  for (let i = ASCENDING_KEYS.length - 1; i >= 0; i--) {
    const key = ASCENDING_KEYS[i];
    if (key !== undefined && BREAKPOINT_MIN[key] <= width) return key;
  }
  return 'base';
}

export function editBreakpoint(
  width: number,
  primaryWidth: number,
  mode: ResponsiveMode,
): Breakpoint {
  const targetBand = bandOf(width, mode);
  const primaryBand = bandOf(primaryWidth, mode);
  return targetBand === primaryBand ? 'base' : targetBand;
}

export function effectiveStyleValue(
  node: Pick<DesignNode, 'style' | 'responsive'>,
  property: keyof StyleProps,
  width: number,
  mode: ResponsiveMode,
): { readonly value: unknown; readonly from: Breakpoint | undefined } {
  let currentValue: unknown = node.style?.[property];
  let fromBreakpoint: Breakpoint | undefined = currentValue !== undefined ? 'base' : undefined;

  const cascadeOrder = mode === 'desktop-first' ? DESKTOP_CASCADE : MOBILE_CASCADE;

  for (const key of cascadeOrder) {
    const min = BREAKPOINT_MIN[key];
    const applies = mode === 'desktop-first' ? min > width : min <= width;
    if (!applies) continue;

    const override = node.responsive?.[key]?.[property];
    if (override !== undefined) {
      currentValue = override;
      fromBreakpoint = key;
    }
  }

  return { value: currentValue, from: fromBreakpoint };
}

export function styleScope(
  breakpoint: Breakpoint,
  state?: InteractionState,
): StyleScope | undefined {
  if (state !== undefined) {
    if (breakpoint !== 'base') return undefined;
    return { state };
  }
  if (breakpoint === 'base') return {};
  return { breakpoint };
}
