// Zustand store for Studio element selection, Layer Tree, and Canvas mode (SPEC-04 M-SL, R-SL-05).
import type { ElementInfo, ElementRef, TreeNode } from '@kumicraft/shared';
import { create } from 'zustand';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';

export type CanvasMode = 'design' | 'preview';

export type SelectionState = {
  readonly selectedRefs: readonly ElementRef[];
  readonly selectionInfo: readonly ElementInfo[];
  readonly hoveredRef: ElementRef | undefined;
  readonly treeNodes: readonly TreeNode[];
  readonly treeTruncated: boolean;
  readonly mode: CanvasMode;
  readonly currentRoute: string;
  /** The Bridge of the page in the Canvas said `ready` (R-RN-24). */
  readonly bridgeReady: boolean;

  readonly setSelectedRefs: (refs: readonly ElementRef[]) => void;
  readonly setSelectionInfo: (items: readonly ElementInfo[]) => void;
  readonly setHoveredRef: (ref: ElementRef | undefined) => void;
  readonly setTree: (nodes: readonly TreeNode[], truncated?: boolean) => void;
  readonly setMode: (mode: CanvasMode) => void;
  readonly setRoute: (route: string) => void;
  readonly setBridgeReady: (ready: boolean) => void;
  readonly clearSelection: () => void;
  readonly reset: () => void;
};

const INITIAL_STATE = {
  selectedRefs: [],
  selectionInfo: [],
  hoveredRef: undefined,
  treeNodes: [],
  treeTruncated: false,
  mode: 'design' as const,
  currentRoute: '/',
  bridgeReady: false,
};

const refKey = (ref: ElementRef) => `${ref.loc}#${String(ref.index)}`;

function keepRefsInTree(
  refs: readonly ElementRef[],
  nodes: readonly TreeNode[],
): readonly ElementRef[] {
  const present = new Set(nodes.map((node) => refKey(node.ref)));
  const kept = refs.filter((ref) => present.has(refKey(ref)));
  return kept.length === refs.length ? refs : kept;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  ...INITIAL_STATE,
  setSelectedRefs: (refs) => {
    set({ selectedRefs: refs });
  },
  setSelectionInfo: (items) => {
    set({ selectionInfo: items });
  },
  setHoveredRef: (ref) => {
    set({ hoveredRef: ref });
  },
  setTree: (nodes, truncated = false) => {
    set((state) => ({
      treeNodes: nodes,
      treeTruncated: truncated,
      // R-SL-10: refs gone from the new tree leave the selection; the last one left is the
      // primary. A truncated tree (V-113) cannot tell what is gone, so the selection stays.
      selectedRefs: truncated ? state.selectedRefs : keepRefsInTree(state.selectedRefs, nodes),
    }));
  },
  setMode: (mode) => {
    set({ mode });
  },
  setRoute: (route) => {
    set({ currentRoute: route });
    const viewStore = useCanvasViewStore.getState();
    if (viewStore.activeOpenFrameId) {
      viewStore.updateOpenFrame(viewStore.activeOpenFrameId, { route });
    }
  },
  setBridgeReady: (ready) => {
    set({ bridgeReady: ready });
  },
  clearSelection: () => {
    set({ selectedRefs: [], selectionInfo: [] });
  },
  reset: () => {
    set(INITIAL_STATE);
  },
}));
