// Design target store and bridge synchronization hook (SPEC-04 R-CP-11, spec-log #23).
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import { usePagesData } from '../editor/page-select.tsx';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { type DesignTarget, designTargetOf } from './design-target.ts';

export type ComponentMode = {
  readonly componentName: string;
  readonly filePath: string;
};

export type DesignState = {
  readonly target?: DesignTarget | undefined;
  readonly componentMode?: ComponentMode | undefined;
  setTarget: (target?: DesignTarget) => void;
  enterComponentMode: (mode: ComponentMode) => void;
  exitComponentMode: () => void;
};

export const useDesignStore = create<DesignState>((set, get) => ({
  target: undefined,
  componentMode: undefined,
  setTarget: (target) => {
    set({ target });
  },
  enterComponentMode: (mode) => {
    set({ componentMode: mode });
    studioBridgeChannel.setDesignFile(mode.filePath, true);
  },
  exitComponentMode: () => {
    set({ componentMode: undefined });
    const target = get().target;
    studioBridgeChannel.setDesignFile(target?.file, false);
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
  const prevRouteRef = useRef<string>(currentRoute);

  useEffect(() => {
    if (prevRouteRef.current !== currentRoute) {
      prevRouteRef.current = currentRoute;
      if (useDesignStore.getState().componentMode !== undefined) {
        useDesignStore.getState().exitComponentMode();
      }
    }
  }, [currentRoute]);

  useEffect(() => {
    const nextTarget = designTargetOf(pages, currentRoute);
    useDesignStore.getState().setTarget(nextTarget);

    if (bridgeReady) {
      const justBecameReady = !prevReadyRef.current;
      const compMode = useDesignStore.getState().componentMode;
      const activeFile = compMode ? compMode.filePath : nextTarget.file;
      const activeFocus = compMode !== undefined ? true : undefined;
      const fileChanged = activeFile !== lastSentFile.current;
      if (justBecameReady || fileChanged) {
        studioBridgeChannel.setDesignFile(activeFile, activeFocus);
        lastSentFile.current = activeFile;
      }
    } else {
      lastSentFile.current = undefined;
    }
    prevReadyRef.current = bridgeReady;
  }, [pages, currentRoute, bridgeReady]);
}
