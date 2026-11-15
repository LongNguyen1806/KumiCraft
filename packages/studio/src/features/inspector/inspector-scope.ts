// Scope and write prefix calculation for Inspector (SPEC-04 section 9 M-IN).
import {
  type Breakpoint,
  editBreakpoint,
  type Frame,
  type InteractionState,
  type ProjectBreakpoint,
  type ResponsiveMode,
  type Scope,
} from '@kumicraft/shared';
import { useMemo } from 'react';

const STATE_VARIANT: Readonly<Record<InteractionState, string>> = {
  hover: 'hover',
  active: 'active',
  focus: 'focus',
  disabled: 'disabled',
  groupHover: 'group-hover',
  selected: 'data-[selected=true]',
};

export function computeWritePrefix(scope: Scope, mode: ResponsiveMode): string {
  const parts: string[] = [];
  if (scope.breakpoint !== 'base') {
    parts.push(mode === 'desktop-first' ? `max-${scope.breakpoint}` : scope.breakpoint);
  }
  if (scope.dark === true) {
    parts.push('dark');
  }
  if (scope.state !== undefined) {
    parts.push(STATE_VARIANT[scope.state]);
  }
  return parts.length > 0 ? `${parts.join(':')}:` : '';
}

export function useScopeCalculation(
  frame: Frame | undefined,
  primaryFrame: Frame | undefined,
  responsiveMode: ResponsiveMode,
  interactionState: InteractionState | undefined,
  breakpoints?: readonly ProjectBreakpoint[],
  dark?: boolean,
): {
  readonly currentScope: Scope;
  readonly writePrefix: string;
  readonly frameBreakpoint: Breakpoint;
} {
  return useMemo(() => {
    const frameW = frame?.width ?? 1440;
    const primW = primaryFrame?.width ?? 1440;
    // Edits reach every screen (spec-log #141): the frame decides only what "only this screen"
    // means, which the per-screen writer (Tailwind) or a media query (plain CSS) turns into code.
    const scope: Scope = {
      breakpoint: 'base',
      state: interactionState,
      ...(dark === true ? { dark: true } : {}),
    };
    return {
      currentScope: scope,
      writePrefix: computeWritePrefix(scope, responsiveMode),
      frameBreakpoint: editBreakpoint(frameW, primW, responsiveMode, breakpoints),
    };
  }, [frame?.width, primaryFrame?.width, responsiveMode, interactionState, breakpoints, dark]);
}
