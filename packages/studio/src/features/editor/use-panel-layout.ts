// Side panels of the Editor: 200 to 480 px wide, hidden or shown, remembered by
// the browser. Not sensitive, so localStorage is fine; the address stays the same between sessions
// (SPEC-05 S-02), so the browser finds them again.
import { useCallback, useState } from 'react';

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

export function usePanelLayout() {
  const [layout, setLayout] = useState<PanelLayout>(readLayout);

  const update = useCallback((change: (current: PanelLayout) => PanelLayout) => {
    setLayout((current) => {
      const next = change(current);
      saveLayout(next);
      return next;
    });
  }, []);

  const toggle = useCallback(
    (side: Side) => {
      update((current) => ({
        ...current,
        visible: { ...current.visible, [side]: !current.visible[side] },
      }));
    },
    [update],
  );

  /** Both hidden → show both; otherwise hide both (Mod+\). */
  const toggleBoth = useCallback(() => {
    update((current) => {
      const show = !current.visible.left && !current.visible.right;
      return { ...current, visible: { left: show, right: show } };
    });
  }, [update]);

  const resize = useCallback(
    (side: Side, width: number) => {
      update((current) => ({ ...current, width: { ...current.width, [side]: clampWidth(width) } }));
    },
    [update],
  );

  return { layout, toggle, toggleBoth, resize };
}
