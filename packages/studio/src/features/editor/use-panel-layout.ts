// Side panels of the Editor: 200 to 480 px wide, hidden or shown, remembered by
// the browser. Not sensitive, so localStorage is fine (SPEC-05 S-02).
import { create } from 'zustand';

export type Side = 'left' | 'right';

export const MIN_PANEL = 200;
export const MAX_PANEL = 480;
const DEFAULT_WIDTH: Record<Side, number> = { left: 268, right: 308 };
const KEY = 'reactcraft.panels';

export type PanelLayout = {
  readonly width: Readonly<Record<Side, number>>;
  readonly visible: Readonly<Record<Side, boolean>>;
};

const DEFAULT_LAYOUT: PanelLayout = { width: DEFAULT_WIDTH, visible: { left: true, right: true } };

export const clampWidth = (width: number): number =>
  Math.round(Math.min(MAX_PANEL, Math.max(MIN_PANEL, width)));

/** Reads the saved layout; anything missing or wrong falls back to the default. */
export function readLayout(): PanelLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<PanelLayout>;
    const width = (side: Side) => {
      const value = saved.width?.[side];
      return typeof value === 'number' ? clampWidth(value) : DEFAULT_WIDTH[side];
    };
    const visible = (side: Side) => saved.visible?.[side] !== false;
    return {
      width: { left: width('left'), right: width('right') },
      visible: { left: visible('left'), right: visible('right') },
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: PanelLayout): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // Private windows may refuse storage: the layout then lasts for this visit only.
  }
}

export type PanelStore = {
  readonly layout: PanelLayout;
  readonly toggle: (side: Side) => void;
  readonly toggleBoth: () => void;
  readonly resize: (side: Side, width: number) => void;
};

export const usePanelLayoutStore = create<PanelStore>((set) => ({
  layout: readLayout(),
  toggle: (side) => {
    set((state) => {
      const next: PanelLayout = {
        ...state.layout,
        visible: { ...state.layout.visible, [side]: !state.layout.visible[side] },
      };
      saveLayout(next);
      return { layout: next };
    });
  },
  toggleBoth: () => {
    set((state) => {
      const show = !state.layout.visible.left && !state.layout.visible.right;
      const next: PanelLayout = {
        ...state.layout,
        visible: { left: show, right: show },
      };
      saveLayout(next);
      return { layout: next };
    });
  },
  resize: (side, width) => {
    set((state) => {
      const next: PanelLayout = {
        ...state.layout,
        width: { ...state.layout.width, [side]: clampWidth(width) },
      };
      saveLayout(next);
      return { layout: next };
    });
  },
}));

export function usePanelLayout() {
  const layout = usePanelLayoutStore((s) => s.layout);
  const toggle = usePanelLayoutStore((s) => s.toggle);
  const toggleBoth = usePanelLayoutStore((s) => s.toggleBoth);
  const resize = usePanelLayoutStore((s) => s.resize);
  return { layout, toggle, toggleBoth, resize };
}
