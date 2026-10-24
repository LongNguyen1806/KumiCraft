// Layer menu store for canvas context menu (SPEC-04 R-SL-13, WP-2.12c).
import type { BridgeLayerMenuPayload } from '@kumicraft/shared';
import { create } from 'zustand';

export type LayerMenuState = {
  readonly menu?: BridgeLayerMenuPayload | undefined;
  show: (menu: BridgeLayerMenuPayload) => void;
  close: () => void;
};

export const useLayerMenuStore = create<LayerMenuState>((set) => ({
  menu: undefined,
  show: (menu) => {
    set({ menu });
  },
  close: () => {
    set({ menu: undefined });
  },
}));
