// Where an Inspector change of plain CSS goes, remembered per element for the session (R-ST-07).
import { create } from 'zustand';

export type StyleTarget = 'rule' | 'element';

type StyleTargetState = {
  readonly byElement: Readonly<Record<string, StyleTarget>>;
  setTarget: (elementKey: string, target: StyleTarget) => void;
};

export const useStyleTargetStore = create<StyleTargetState>((set) => ({
  byElement: {},
  setTarget: (elementKey, target) => {
    set((s) => ({ byElement: { ...s.byElement, [elementKey]: target } }));
  },
}));

/** "All N elements" unless the user chose "only this element" for it (owner, 2026-10-24). */
export function useStyleTarget(elementKey: string | undefined): StyleTarget {
  return useStyleTargetStore((s) =>
    elementKey === undefined ? 'rule' : (s.byElement[elementKey] ?? 'rule'),
  );
}
