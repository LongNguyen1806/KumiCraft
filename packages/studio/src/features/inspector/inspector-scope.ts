// Scope and write prefix calculation for Inspector (SPEC-04 section 9 M-IN).
import {
  editBreakpoint,
  type Frame,
  type InteractionState,
  type ResponsiveMode,
  type Scope,
} from '@reactcraft/shared';
import { useMemo } from 'react';

export function computeWritePrefix(scope: Scope, mode: ResponsiveMode): string {
  const parts: string[] = [];
  if (scope.breakpoint !== 'base') {
    parts.push(mode === 'desktop-first' ? `max-${scope.breakpoint}` : scope.breakpoint);
  }
  if (scope.state !== undefined) {
    parts.push(scope.state);
  }
  return parts.length > 0 ? `${parts.join(':')}:` : '';
}

export function useScopeCalculation(
  frame: Frame | undefined,
  primaryFrame: Frame | undefined,
  responsiveMode: ResponsiveMode,
  interactionState: InteractionState | undefined,
): { readonly currentScope: Scope; readonly writePrefix: string } {
  return useMemo(() => {
    const frameW = frame?.width ?? 1440;
    const primW = primaryFrame?.width ?? 1440;
    const breakpoint = editBreakpoint(frameW, primW, responsiveMode);
    const scope: Scope = { breakpoint, state: interactionState };
    return {
      currentScope: scope,
      writePrefix: computeWritePrefix(scope, responsiveMode),
    };
  }, [frame?.width, primaryFrame?.width, responsiveMode, interactionState]);
}
