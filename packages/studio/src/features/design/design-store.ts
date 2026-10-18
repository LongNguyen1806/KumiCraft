// Design target store and bridge synchronization hook (SPEC-04 R-CP-11, spec-log #23).
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import { usePagesData } from '../editor/page-select.tsx';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { type DesignTarget, designTargetOf } from './design-target.ts';

export type DesignState = {
  readonly target?: DesignTarget | undefined;
  setTarget: (target?: DesignTarget) => void;
};

export const useDesignStore = create<DesignState>((set) => ({
  target: undefined,
  setTarget: (target) => {
    set({ target });
  },
}));

/**
 * Synchronizes the current page design target with the store and notifies the Bridge
 * via `design-file` when the target file changes or when Bridge reports ready.
 */
export function useDesignTargetSync(): void {
  const { pages } = usePagesData();
  const currentRoute = useSelectionStore((s) => s.currentRoute);
  const bridgeReady = useSelectionStore((s) => s.bridgeReady);
  const lastSentFile = useRef<string | undefined>(undefined);
  const prevReadyRef = useRef<boolean>(false);

  useEffect(() => {
    const nextTarget = designTargetOf(pages, currentRoute);
    useDesignStore.getState().setTarget(nextTarget);

    if (bridgeReady) {
      const justBecameReady = !prevReadyRef.current;
      const fileChanged = nextTarget.file !== lastSentFile.current;
      if (justBecameReady || fileChanged) {
        studioBridgeChannel.setDesignFile(nextTarget.file);
        lastSentFile.current = nextTarget.file;
      }
    } else {
      lastSentFile.current = undefined;
    }
    prevReadyRef.current = bridgeReady;
  }, [pages, currentRoute, bridgeReady]);
}
