// Which item of the left activity bar is open, remembered per machine (spec-log #66, K3a).
import { create } from 'zustand';

import { usePanelLayoutStore } from '../editor/use-panel-layout.ts';
import { useStyleLayerSupported } from '../project/use-style-edit.ts';

export const ACTIVITY_IDS = [
  'layers',
  'library',
  'components',
  'pages',
  'drafts',
  'brand',
] as const;

export type ActivityId = (typeof ACTIVITY_IDS)[number];

export const ACTIVITY_KEY = 'kumicraft.activity';
export const OLD_LEFT_PANEL_KEY = 'kumicraft.leftPanelTab';
export const OLD_RIGHT_PANEL_KEY = 'kumicraft.rightPanelTab';

export function isActivityId(value: string | undefined): value is ActivityId {
  return typeof value === 'string' && (ACTIVITY_IDS as readonly string[]).includes(value);
}

export function saveActivity(id: ActivityId): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, id);
  } catch {
    // Private windows may refuse storage
  }
}

export function readInitialActivity(): ActivityId {
  try {
    const saved = localStorage.getItem(ACTIVITY_KEY) ?? undefined;
    if (isActivityId(saved)) {
      return saved;
    }

    // One-time migration from the old tab keys. The right panel still keeps its own tab in
    // `rightPanelTab`; only its old `brand` value moves here.
    const oldRight = localStorage.getItem(OLD_RIGHT_PANEL_KEY) ?? undefined;
    const oldLeft = localStorage.getItem(OLD_LEFT_PANEL_KEY) ?? undefined;
    const migrated: ActivityId | undefined =
      oldRight === 'brand' ? 'brand' : isActivityId(oldLeft) ? oldLeft : undefined;
    if (oldRight === 'brand') localStorage.removeItem(OLD_RIGHT_PANEL_KEY);
    localStorage.removeItem(OLD_LEFT_PANEL_KEY);
    // Saved even when nothing moved, so the migration never runs again.
    saveActivity(migrated ?? 'layers');
    return migrated ?? 'layers';
  } catch {
    return 'layers';
  }
}

export type ActivityStore = {
  readonly active: ActivityId;
  readonly setActive: (id: ActivityId) => void;
  readonly initFromStorage: () => void;
};

export const useActivityStore = create<ActivityStore>((set) => ({
  active: readInitialActivity(),
  setActive: (id) => {
    saveActivity(id);
    set({ active: id });
  },
  initFromStorage: () => {
    set({ active: readInitialActivity() });
  },
}));

export function activate(id: ActivityId, options?: { readonly keepOpen?: boolean }): void {
  const { active, setActive } = useActivityStore.getState();
  const { layout, toggle, show } = usePanelLayoutStore.getState();
  if (id === active && layout.visible.left && !options?.keepOpen) {
    toggle('left');
  } else {
    setActive(id);
    show('left');
  }
}

/** The item the left panel shows: Brand falls back to Layers in a project without style adapter. */
export function useShownActivity(): ActivityId {
  const active = useActivityStore((s) => s.active);
  const brandSupported = useStyleLayerSupported();
  return active === 'brand' && !brandSupported ? 'layers' : active;
}
