// Layer menu store for canvas context menu (SPEC-04 R-SL-13, WP-2.12c).
import type { BridgeLayerMenuPayload } from '@kumicraft/shared';
import { create } from 'zustand';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';

export type LayerMenuState = {
  readonly menu?: BridgeLayerMenuPayload | undefined;
  /** The open Canvas frame the menu was opened in: only that frame draws it (M-MF). */
  readonly frameId?: string | undefined;
  show: (menu: BridgeLayerMenuPayload) => void;
  close: () => void;
};

export const useLayerMenuStore = create<LayerMenuState>((set) => ({
  menu: undefined,
  show: (menu) => {
    // Only the working frame's Bridge messages reach here, so the menu belongs to that frame.
    set({ menu, frameId: useCanvasViewStore.getState().activeOpenFrameId });
  },
  close: () => {
    set({ menu: undefined, frameId: undefined });
  },
}));
