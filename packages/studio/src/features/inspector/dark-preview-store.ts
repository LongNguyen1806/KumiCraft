// Dark preview toggle state for Canvas and Inspector contrast workflows (K9.8-1 TK-74, TK-75).
import { create } from 'zustand';

type DarkPreviewStoreState = {
  readonly canvasDark: boolean;
  readonly inspectorDarkByElement: Readonly<Record<string, boolean>>;
  setCanvasDark: (dark: boolean) => void;
  setInspectorDark: (elementKey: string, dark: boolean) => void;
};

export const useDarkPreviewStore = create<DarkPreviewStoreState>((set) => ({
  canvasDark: false,
  inspectorDarkByElement: {},
  setCanvasDark: (dark) => {
    set({ canvasDark: dark });
  },
  setInspectorDark: (elementKey, dark) => {
    set((s) => ({
      inspectorDarkByElement: { ...s.inspectorDarkByElement, [elementKey]: dark },
    }));
  },
}));

export function useElementDarkMode(elementKey: string | undefined): boolean {
  const canvasDark = useDarkPreviewStore((s) => s.canvasDark);
  const perElement = useDarkPreviewStore((s) =>
    elementKey === undefined ? undefined : s.inspectorDarkByElement[elementKey],
  );
  return perElement ?? canvasDark;
}
