// Zustand store for Studio element selection, Layer Tree, and Canvas mode (SPEC-04 M-SL, R-SL-05).
import type { ElementInfo, ElementRef, TreeNode } from '@reactcraft/shared';
import { create } from 'zustand';

export type CanvasMode = 'design' | 'preview';

export type SelectionState = {
  readonly selectedRefs: readonly ElementRef[];
  readonly selectionInfo: readonly ElementInfo[];
  readonly hoveredRef: ElementRef | undefined;
  readonly treeNodes: readonly TreeNode[];
  readonly treeTruncated: boolean;
  readonly mode: CanvasMode;
  readonly currentRoute: string;

  readonly setSelectedRefs: (refs: readonly ElementRef[]) => void;
  readonly setSelectionInfo: (items: readonly ElementInfo[]) => void;
  readonly setHoveredRef: (ref: ElementRef | undefined) => void;
  readonly setTree: (nodes: readonly TreeNode[], truncated?: boolean) => void;
  readonly setMode: (mode: CanvasMode) => void;
  readonly setRoute: (route: string) => void;
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
};

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
    set({ treeNodes: nodes, treeTruncated: truncated });
  },
  setMode: (mode) => {
    set({ mode });
  },
  setRoute: (route) => {
    set({ currentRoute: route });
  },
  clearSelection: () => {
    set({ selectedRefs: [], selectionInfo: [] });
  },
  reset: () => {
    set(INITIAL_STATE);
  },
}));
