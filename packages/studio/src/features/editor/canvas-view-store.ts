// Zustand store for Canvas view state (zoom, frame, mode) (SPEC-04 R-RN-21, R-KB-12).
import { defaultFrames, type Frame, type Placement } from '@reactcraft/shared';
import { create } from 'zustand';

export type CanvasMode = 'design' | 'preview';
export type Zoom = number | 'fit';
export type CanvasGridSize = 1 | 4 | 8 | 16;
export const CANVAS_GRID_SIZES: readonly CanvasGridSize[] = [1, 4, 8, 16];

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type CanvasViewState = {
  readonly mode: CanvasMode;
  readonly zoom: Zoom;
  readonly displayedZoom: number;
  readonly activeFrameId: string;
  readonly frames: readonly Frame[];
  readonly draftFile?: string | undefined;
  readonly grid: CanvasGridSize;
  readonly setGrid: (grid: CanvasGridSize) => void;
  /** Tailwind major version of the open project (WP-2.12a section 3.1). */
  readonly tailwindMajor: 3 | 4;
  readonly setTailwindMajor: (major: 3 | 4) => void;
  /** Drafts folder of the open project (R-FF-19). */
  readonly draftsDir: string;
  readonly setDraftsDir: (dir: string) => void;
  readonly setMode: (mode: CanvasMode | ((prev: CanvasMode) => CanvasMode)) => void;
  readonly toggleMode: () => void;
  readonly setZoom: (zoom: Zoom) => void;
  readonly setDisplayedZoom: (val: number) => void;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  readonly zoomReset: () => void;
  readonly zoomFit: () => void;
  readonly setActiveFrameId: (id: string) => void;
  readonly setFrames: (frames: readonly Frame[]) => void;
  readonly selectFrameByIndex: (index: number) => boolean;
  readonly openDraft: (file: string, projectId?: string) => void;
  readonly closeDraft: (projectId?: string) => void;
};

/** Tailwind major to send with a placement; none without one (WP-2.12a section 3.3). */
export function placementTailwindMajor(placement: Placement | undefined): 3 | 4 | undefined {
  return placement === undefined ? undefined : useCanvasViewStore.getState().tailwindMajor;
}

const GRID_STORAGE_KEY = 'reactcraft:canvas-grid';

export function getStoredGrid(): CanvasGridSize {
  try {
    const val = localStorage.getItem(GRID_STORAGE_KEY);
    const n = Number(val);
    if (n === 1 || n === 4 || n === 8 || n === 16) return n;
  } catch {
    // Ignore storage errors
  }
  return 8;
}

export function setStoredGrid(grid: CanvasGridSize): void {
  try {
    localStorage.setItem(GRID_STORAGE_KEY, String(grid));
  } catch {
    // Ignore storage errors
  }
}

const DRAFT_STORAGE_PREFIX = 'reactcraft:draft:';

export function getStoredDraftFile(projectId: string): string | undefined {
  try {
    const val = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${projectId}`);
    return val && val.trim().length > 0 ? val : undefined;
  } catch {
    return undefined;
  }
}

export function setStoredDraftFile(projectId: string, file: string | undefined): void {
  try {
    if (file) {
      localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${projectId}`, file);
    } else {
      localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${projectId}`);
    }
  } catch {
    // Ignore storage errors
  }
}

function stepZoom(current: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    return ZOOM_STEPS.find((s) => s > current + 0.001) ?? 2;
  }
  const reversed = [...ZOOM_STEPS].reverse();
  return reversed.find((s) => s < current - 0.001) ?? 0.5;
}

function updateFrames(frames: readonly Frame[], activeId: string) {
  const exists = frames.some((f) => f.id === activeId);
  return { frames, activeFrameId: exists ? activeId : (frames[0]?.id ?? 'desktop') };
}

function createZoomActions(
  set: (
    updater: Partial<CanvasViewState> | ((s: CanvasViewState) => Partial<CanvasViewState>),
  ) => void,
) {
  return {
    zoomIn: () => {
      set((s) => ({ zoom: stepZoom(typeof s.zoom === 'number' ? s.zoom : s.displayedZoom, 'in') }));
    },
    zoomOut: () => {
      set((s) => ({
        zoom: stepZoom(typeof s.zoom === 'number' ? s.zoom : s.displayedZoom, 'out'),
      }));
    },
    zoomReset: () => {
      set({ zoom: 1 });
    },
    zoomFit: () => {
      set({ zoom: 'fit' });
    },
  };
}

function createDraftActions(
  set: (
    updater: Partial<CanvasViewState> | ((s: CanvasViewState) => Partial<CanvasViewState>),
  ) => void,
) {
  return {
    openDraft: (file: string, projectId?: string) => {
      set({ draftFile: file });
      if (projectId) setStoredDraftFile(projectId, file);
    },
    closeDraft: (projectId?: string) => {
      set({ draftFile: undefined });
      if (projectId) setStoredDraftFile(projectId, undefined);
    },
  };
}

function createProjectFactActions(
  set: (
    updater: Partial<CanvasViewState> | ((s: CanvasViewState) => Partial<CanvasViewState>),
  ) => void,
) {
  return {
    tailwindMajor: 4 as const,
    setTailwindMajor: (tailwindMajor: 3 | 4) => {
      set({ tailwindMajor });
    },
    draftsDir: 'src/drafts',
    setDraftsDir: (draftsDir: string) => {
      set({ draftsDir });
    },
  };
}

export const useCanvasViewStore = create<CanvasViewState>((set, get) => ({
  mode: 'design',
  zoom: 'fit',
  displayedZoom: 1,
  activeFrameId: 'desktop',
  frames: defaultFrames('desktop-first').frames,
  grid: getStoredGrid(),
  setGrid: (grid) => {
    setStoredGrid(grid);
    set({ grid });
  },
  ...createProjectFactActions(set),

  setMode: (mode) => {
    set((state) => ({
      mode: typeof mode === 'function' ? mode(state.mode) : mode,
    }));
  },
  toggleMode: () => {
    set((state) => ({
      mode: state.mode === 'design' ? 'preview' : 'design',
    }));
  },
  setZoom: (zoom) => {
    set({ zoom });
  },
  setDisplayedZoom: (displayedZoom) => {
    set({ displayedZoom });
  },
  ...createZoomActions(set),
  setActiveFrameId: (activeFrameId) => {
    set({ activeFrameId });
  },
  setFrames: (frames) => {
    if (frames.length > 0) set((s) => updateFrames(frames, s.activeFrameId));
  },
  selectFrameByIndex: (index) => {
    const { frames } = get();
    const target = frames[index];
    if (target) {
      set({ activeFrameId: target.id });
      return true;
    }
    return false;
  },
  draftFile: undefined,
  ...createDraftActions(set),
}));
