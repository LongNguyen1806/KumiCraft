// Where an Inspector change of plain CSS goes, remembered per element for the session (R-ST-07).
import type { StyleState } from '@kumicraft/shared';
import { create } from 'zustand';

export type StyleTarget = 'rule' | 'element';

type StyleTargetState = {
  readonly byElement: Readonly<Record<string, StyleTarget>>;
  readonly byElementState: Readonly<Record<string, StyleState | undefined>>;
  setTarget: (elementKey: string, target: StyleTarget) => void;
  setState: (elementKey: string, state: StyleState | undefined) => void;
};

export const useStyleTargetStore = create<StyleTargetState>((set) => ({
  byElement: {},
  byElementState: {},
  setTarget: (elementKey, target) => {
    set((s) => ({ byElement: { ...s.byElement, [elementKey]: target } }));
  },
  setState: (elementKey, state) => {
    set((s) => ({ byElementState: { ...s.byElementState, [elementKey]: state } }));
  },
}));

/** "All N elements" unless the user chose "only this element" for it (owner, 2026-10-24). */
export function useStyleTarget(elementKey: string | undefined): StyleTarget {
  return useStyleTargetStore((s) =>
    elementKey === undefined ? 'rule' : (s.byElement[elementKey] ?? 'rule'),
  );
}

/** The pseudo-state (`hover`, `focus`, `disabled`) chosen for `elementKey`, or `undefined` for Default. */
export function useStyleElementState(elementKey: string | undefined): StyleState | undefined {
  return useStyleTargetStore((s) =>
    elementKey === undefined ? undefined : s.byElementState[elementKey],
  );
}
