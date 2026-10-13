// Resolves the current edit scope and scope bar text (SPEC-04.1 section 11.1, V-28, WP-1.09 part B).
import {
  type Breakpoint,
  BREAKPOINT_MIN,
  editBreakpoint,
  type Frame,
  type InteractionState,
  type ResponsiveMode,
  type StyleScope,
  styleScope,
} from '@reactcraft/model';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type UseInspectorScopeProps = {
  readonly frame: Frame;
  readonly primaryFrame: Frame;
  readonly responsiveMode: ResponsiveMode;
};

export type InspectorScopeResult = {
  readonly breakpoint: Breakpoint;
  readonly state: InteractionState | undefined;
  readonly setState: (s: InteractionState | undefined) => void;
  readonly scope: StyleScope;
  readonly scopeText: string;
};

function stateLabelOf(t: ReturnType<typeof useTranslation>['t'], state: InteractionState): string {
  switch (state) {
    case 'hover':
      return t('inspector.states.hover');
    case 'focus':
      return t('inspector.states.focus');
    case 'disabled':
      return t('inspector.states.disabled');
  }
}

function formatScopeText(
  t: ReturnType<typeof useTranslation>['t'],
  frame: Frame,
  breakpoint: Breakpoint,
  mode: ResponsiveMode,
  state: InteractionState | undefined,
): string {
  const prefix = t('inspector.scopePrefix');
  const baseOrOverride =
    breakpoint === 'base'
      ? t('inspector.base')
      : mode === 'desktop-first'
        ? t('inspector.overrideDesktopFirst', { min: BREAKPOINT_MIN[breakpoint] })
        : t('inspector.overrideMobileFirst', { min: BREAKPOINT_MIN[breakpoint] });
  const text = `${prefix} ${frame.label} ${String(frame.width)} · ${baseOrOverride}`;
  if (state !== undefined) {
    return `${text} · ${stateLabelOf(t, state)}`;
  }
  return text;
}

export function useInspectorScope({
  frame,
  primaryFrame,
  responsiveMode,
}: UseInspectorScopeProps): InspectorScopeResult {
  const { t } = useTranslation();
  const [state, setState] = useState<InteractionState | undefined>(undefined);
  const breakpoint = editBreakpoint(frame.width, primaryFrame.width, responsiveMode);
  // V-28 and the contract of 9B: moving to a frame with an override key goes back to Normal, so
  // coming back to the primary frame does not silently edit a state again.
  // (React's "adjust state when a prop changes" pattern: no effect, no extra render pass.)
  const [seenBreakpoint, setSeenBreakpoint] = useState(breakpoint);
  if (seenBreakpoint !== breakpoint) {
    setSeenBreakpoint(breakpoint);
    if (breakpoint !== 'base') setState(undefined);
  }

  // V-28: states exist only at the base key
  const effectiveState = breakpoint === 'base' ? state : undefined;
  const scope = styleScope(breakpoint, effectiveState) ?? {};
  const scopeText = formatScopeText(t, frame, breakpoint, responsiveMode, effectiveState);

  return {
    breakpoint,
    state: effectiveState,
    setState,
    scope,
    scopeText,
  };
}
