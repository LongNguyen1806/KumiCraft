// Sends one Inspector change of plain CSS to the style layer (SPEC-04 M-ST, R-ST-06, R-ST-09).
import { type Breakpoint, mediaForBreakpoint, type ResponsiveMode } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStyle } from '../../api/style-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import type { StyleState } from './style-reading.ts';
import type { StyleTarget } from './style-target-store.ts';

export type StyleCommitContext = {
  readonly state: StyleState | undefined;
  readonly refresh: () => void;
  readonly breakpoint: Breakpoint;
  readonly mode: ResponsiveMode;
  readonly tag: string;
  readonly target: StyleTarget;
};

/** An empty value removes the declaration. Errors come back as text for the Inspector. */
export function useStyleCommit(ctx: StyleCommitContext): {
  readonly commit: (property: string, value: string) => void;
  readonly error: string | undefined;
} {
  const { t: tError } = useTranslation('errors');
  const [error, setError] = useState<string>();

  const send = async (property: string, value: string) => {
    if (ctx.state === undefined) return;
    setError(undefined);
    const media = mediaForBreakpoint(ctx.breakpoint, ctx.mode);
    try {
      await applyStyle({
        probe: ctx.state.probe,
        tag: ctx.tag,
        change: {
          property,
          target: ctx.target,
          ...(value === '' ? {} : { value }),
          ...(media === undefined ? {} : { media }),
        },
      });
      // The page takes the new CSS by HMR a moment later; read again then.
      setTimeout(ctx.refresh, 300);
      setTimeout(ctx.refresh, 1_000);
    } catch (cause) {
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
