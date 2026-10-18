// Zustand store for Canvas view state (zoom, frame, mode) (SPEC-04 R-RN-21, R-KB-12).
import { defaultFrames, type Frame } from '@reactcraft/shared';
import { create } from 'zustand';

export type CanvasMode = 'design' | 'preview';
export type Zoom = number | 'fit';

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type CanvasViewState = {
  readonly mode: CanvasMode;
  readonly zoom: Zoom;
  readonly displayedZoom: number;
  readonly activeFrameId: string;
  readonly frames: readonly Frame[];
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
};

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

export const useCanvasViewStore = create<CanvasViewState>((set, get) => ({
  mode: 'design',
  zoom: 'fit',
  displayedZoom: 1,
  activeFrameId: 'desktop',
  frames: defaultFrames('desktop-first').frames,

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
  zoomIn: () => {
    set((s) => ({ zoom: stepZoom(typeof s.zoom === 'number' ? s.zoom : s.displayedZoom, 'in') }));
  },
  zoomOut: () => {
    set((s) => ({ zoom: stepZoom(typeof s.zoom === 'number' ? s.zoom : s.displayedZoom, 'out') }));
  },
  zoomReset: () => {
    set({ zoom: 1 });
  },
  zoomFit: () => {
    set({ zoom: 'fit' });
  },
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
}));
