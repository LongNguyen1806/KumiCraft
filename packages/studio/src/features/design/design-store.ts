// Design target store and bridge synchronization hook (SPEC-04 R-CP-11, spec-log #23).
import { useEffect, useRef } from 'react';
import { create } from 'zustand';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
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

/** The file inserts and edits go to: the open component in component mode, else the page's. */
export function currentDesignFile(): string | undefined {
  const { componentMode, target } = useDesignStore.getState();
  return componentMode?.filePath ?? target?.file;
}

function draftTargetOf(draftFile: string, route: string): DesignTarget {
  const baseName =
    draftFile
      .split('/')
      .pop()
      ?.replace(/\.(tsx|jsx)$/, '') ?? draftFile;
  return {
    kind: 'draft',
    name: baseName,
    file: draftFile,
    route,
  };
}

/**
 * Synchronizes the current page design target with the store and notifies the Bridge
 * via `design-file` when the target file changes or when Bridge reports ready.
 */
export function useDesignTargetSync(): void {
  const { pages } = usePagesData();
  const currentRoute = useSelectionStore((s) => s.currentRoute);
  const bridgeReady = useSelectionStore((s) => s.bridgeReady);
  const draftFile = useCanvasViewStore((s) => s.draftFile);
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
    let nextTarget: DesignTarget;
    if (draftFile) {
      nextTarget = draftTargetOf(draftFile, currentRoute);
    } else if (currentRoute.startsWith('/__reactcraft/draft')) {
      nextTarget = { kind: 'page', route: currentRoute };
    } else {
      nextTarget = designTargetOf(pages, currentRoute);
    }
    useDesignStore.getState().setTarget(nextTarget);

    if (bridgeReady) {
      const justBecameReady = !prevReadyRef.current;
      const compMode = useDesignStore.getState().componentMode;
      const activeFile = compMode ? compMode.filePath : nextTarget.file;
      const activeFocus = compMode !== undefined ? true : false;
      const fileChanged = activeFile !== lastSentFile.current;
      if (justBecameReady || fileChanged) {
        studioBridgeChannel.setDesignFile(activeFile, activeFocus);
        lastSentFile.current = activeFile;
      }
    } else {
      lastSentFile.current = undefined;
    }
    prevReadyRef.current = bridgeReady;
  }, [pages, currentRoute, bridgeReady, draftFile]);
}
