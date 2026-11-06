// Sends one Inspector change of plain CSS to the style layer (SPEC-04 M-ST, R-ST-06, R-ST-09).
import {
  type Breakpoint,
  mediaForBreakpoint,
  type ProjectBreakpoint,
  projectBreakpoints,
  type ResponsiveMode,
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
  readonly breakpoints?: readonly ProjectBreakpoint[] | undefined;
};

/** An empty value removes the declaration. Errors come back as text for the Inspector. */
export function useStyleCommit(ctx: StyleCommitContext): {
  readonly commit: (property: string, value: string) => void;
  readonly error: string | undefined;
} {
  const { t: tError } = useTranslation('errors');
  const [error, setError] = useState<string>();
  const theme = useThemeStore((s) => s.theme);

  const send = async (property: string, value: string) => {
    if (ctx.state === undefined) return;
    setError(undefined);
    const breakpoints = ctx.breakpoints ?? projectBreakpoints(theme);
    const media = mediaForBreakpoint(ctx.breakpoint, ctx.mode, breakpoints);
    try {
      await applyStyle({
        probe: ctx.state.probe,
        tag: ctx.tag,
        change: {
          property,
          target: ctx.target,
          ...(value === '' ? {} : { value }),
          ...(media === undefined ? {} : { media }),
          ...(ctx.interactionState === undefined ? {} : { state: ctx.interactionState }),
          ...(ctx.breakpoint === 'base' ? {} : { breakpoint: ctx.breakpoint }),
        },
      });
      // The page takes the new CSS by HMR a moment later; read again then. The preview stays until
      // that first read, so the element does not jump back meanwhile, and must go before it or the
      // probe would see it as inline style (R-ST-13).
      const reread = () => {
        studioBridgeChannel.clearStylePreview();
        ctx.refresh();
      };
      setTimeout(reread, 300);
      setTimeout(ctx.refresh, 1_000);
    } catch (cause) {
      studioBridgeChannel.clearStylePreview();
      const info = toErrorInfo(cause);
      setError(errorText(tError, info.code, info.params));
    }
  };

  return {
    commit: (property, value) => {
      void send(property, value);
    },
    error,
  };
}
