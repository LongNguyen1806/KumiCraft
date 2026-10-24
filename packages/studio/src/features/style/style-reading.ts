// Reads where the style of the selected element comes from (SPEC-04 M-ST, R-ST-04, R-ST-05).
import {
  type BridgeStyleProbePayload,
  CSS_LONGHAND_OF,
  type ElementRef,
  type StyleReading,
} from '@kumicraft/shared';
import { useEffect, useState } from 'react';

import { readStyle } from '../../api/style-client.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';

export const PROBE_TIMEOUT_MS = 2_000;
const PROBED_LONGHANDS = [...new Set(Object.values(CSS_LONGHAND_OF))];

/** Asks the Bridge for the rules of `ref`; undefined when it does not answer in time. */
export function requestStyleProbe(ref: ElementRef): Promise<BridgeStyleProbePayload | undefined> {
  return new Promise((resolve) => {
    const stop = studioBridgeChannel.registerStyleProbeListener((payload) => {
      if (payload.ref.loc !== ref.loc || payload.ref.index !== ref.index) return;
      clearTimeout(timer);
      stop();
      resolve(payload);
    });
    const timer = setTimeout(() => {
      stop();
      resolve(undefined);
    }, PROBE_TIMEOUT_MS);
    studioBridgeChannel.styleProbe(ref, PROBED_LONGHANDS);
  });
}

export type StyleState = {
  readonly probe: BridgeStyleProbePayload;
  readonly reading: StyleReading;
};

export async function fetchStyleState(ref: ElementRef): Promise<StyleState | undefined> {
  const probe = await requestStyleProbe(ref);
  if (probe?.found !== true) return undefined;
  return { probe, reading: await readStyle(probe) };
}

export type UseStyleState = {
  readonly state: StyleState | undefined;
  /** Reads again, for example after a change: the page updates its CSS by HMR, not by a new tree. */
  readonly refresh: () => void;
};

/**
 * The style of the last selected element, read again when the selection changes, the page is
 * rebuilt (a new layer tree arrives after HMR) or `refresh` is called. A reading of another
 * element is never shown.
 */
export function useStyleState(enabled: boolean): UseStyleState {
  const ref = useSelectionStore((s) => s.selectedRefs.at(-1));
  const tree = useSelectionStore((s) => s.treeNodes);
  const [result, setResult] = useState<{ key: string; state?: StyleState | undefined }>();
  const [version, setVersion] = useState(0);
  const loc = ref?.loc;
  const index = ref?.index;
  const key = loc === undefined ? undefined : `${loc}#${String(index)}`;

  useEffect(() => {
    if (!enabled || loc === undefined || index === undefined || key === undefined) return;
    let active = true;
    const load = async () => {
      try {
        const state = await fetchStyleState({ loc, index });
        if (active) setResult({ key, state });
      } catch {
        if (active) setResult({ key });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [enabled, loc, index, key, tree, version]);

  return {
    state: enabled && result?.key === key ? result?.state : undefined,
    refresh: () => {
      setVersion((v) => v + 1);
    },
  };
}
