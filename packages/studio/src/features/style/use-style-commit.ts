// Sends one Inspector change of plain CSS to the style layer (SPEC-04 M-ST, R-ST-06, R-ST-09).
import {
  type Breakpoint,
  mediaForBreakpoint,
  type ProjectBreakpoint,
  projectBreakpoints,
  type ResponsiveMode,
  type StyleApplyRequest,
  type StyleState as StyleInteractionState,
} from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStyle } from '../../api/style-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import type { StyleState } from './style-reading.ts';
import type { StyleTarget } from './style-target-store.ts';

export type StyleCommitContext = {
  readonly state: StyleState | undefined;
  readonly refresh: () => void;
  readonly breakpoint: Breakpoint;
  readonly mode: ResponsiveMode;
  readonly tag: string;
  readonly target: StyleTarget;
  readonly interactionState?: StyleInteractionState | undefined;
  readonly dark?: boolean | undefined;
  readonly groupSelector?: string | undefined;
  readonly breakpoints?: readonly ProjectBreakpoint[] | undefined;
};

/** An empty value removes the declaration. Errors come back as text for the Inspector. */
function buildStyleChangePayload(
  ctx: StyleCommitContext,
  property: string,
  value: string,
  stateOverride: StyleInteractionState | undefined,
  theme: ReturnType<typeof useThemeStore.getState>['theme'],
): StyleApplyRequest['change'] {
  const breakpoints = ctx.breakpoints ?? projectBreakpoints(theme);
  const media = mediaForBreakpoint(ctx.breakpoint, ctx.mode, breakpoints);
  const effectiveState = stateOverride ?? ctx.interactionState;
  return {
    property,
    target: ctx.target,
    ...(value === '' ? {} : { value }),
    ...(media === undefined ? {} : { media }),
    ...(effectiveState === undefined ? {} : { state: effectiveState }),
    ...(ctx.dark === true ? { dark: true } : {}),
    ...(ctx.groupSelector ? { groupSelector: ctx.groupSelector } : {}),
    ...(ctx.breakpoint === 'base' ? {} : { breakpoint: ctx.breakpoint }),
  };
}

export function useStyleCommit(ctx: StyleCommitContext): {
  readonly commit: (
    property: string,
    value: string,
    stateOverride?: StyleInteractionState,
  ) => Promise<void>;
  readonly error: string | undefined;
} {
  const { t: tError } = useTranslation('errors');
  const [error, setError] = useState<string>();
  const theme = useThemeStore((s) => s.theme);

  const send = async (property: string, value: string, stateOverride?: StyleInteractionState) => {
    if (ctx.state === undefined) return;
    setError(undefined);
    try {
      await applyStyle({
        probe: ctx.state.probe,
        tag: ctx.tag,
        change: buildStyleChangePayload(ctx, property, value, stateOverride, theme),
      });
      // The page takes the new CSS by HMR a moment later; read again then. The preview stays until
      // that first read, so the element does not jump back meanwhile, and must go before it or the
      // probe would see it as inline style (R-ST-13).
      setTimeout(() => {
        studioBridgeChannel.clearStylePreview();
        ctx.refresh();
      }, 300);
      setTimeout(ctx.refresh, 1_000);
    } catch (cause) {
      studioBridgeChannel.clearStylePreview();
      const info = toErrorInfo(cause);
      setError(errorText(tError, info.code, info.params));
    }
  };

  return {
    commit: (property, value, stateOverride) => send(property, value, stateOverride),
    error,
  };
}
