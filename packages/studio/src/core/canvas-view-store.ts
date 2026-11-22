// Zustand store for Canvas view state (zoom, frame, mode, tool) (SPEC-04 R-RN-21, R-KB-12, R-DT-10).
import { defaultFrames, type DrawTool, type Frame, type Placement } from '@kumicraft/shared';
import { create } from 'zustand';

import {
  buildNewOpenFrame,
  defaultInitialOpenFrames,
  initStoredFrames,
  MAX_OPEN_FRAMES,
  type OpenFrame,
  resolveCloseTarget,
  setStoredOpenFrames,
} from './open-frames-storage.ts';

export type CanvasMode = 'design' | 'preview';

/**
 * Where a tool change is sent: the Bridge channel registers itself here when it loads, so this
 * store never imports the channel (the channel reads this store).
 */
let toolSink: ((tool: DrawTool) => void) | undefined;

export function setToolSink(sink: ((tool: DrawTool) => void) | undefined): void {
  toolSink = sink;
}

export type Zoom = number | 'fit';
export type CanvasGridSize = 1 | 4 | 8 | 16;
export const CANVAS_GRID_SIZES: readonly CanvasGridSize[] = [1, 4, 8, 16];
export type { OpenFrame };

/** R-RN-21: zoom runs from 10 % to 400 %. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

export type CanvasViewState = {
  readonly mode: CanvasMode;
  readonly tool: DrawTool;
  readonly setTool: (tool: DrawTool) => void;
  /** Pan tool: dragging the Canvas moves the view instead of reaching the page. */
  readonly panning: boolean;
  readonly setPanning: (panning: boolean) => void;
  /** How far the frame is moved from its place, in screen pixels. */
  readonly pan: { readonly x: number; readonly y: number };
  readonly panBy: (dx: number, dy: number) => void;
  readonly zoom: Zoom;
  readonly displayedZoom: number;
  readonly activeFrameId: string;
  readonly frames: readonly Frame[];
  readonly openFrames: readonly OpenFrame[];
  readonly activeOpenFrameId: string;
  readonly currentProjectId?: string | undefined;
  readonly draftFile?: string | undefined;
  readonly grid: CanvasGridSize;
  readonly setGrid: (grid: CanvasGridSize) => void;
  /** Snap dragged elements to the edges and centres of others in a free frame (spec-log #125). */
  readonly snap: boolean;
  readonly setSnap: (snap: boolean) => void;
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
  readonly closeDraft: (projectId?: string, path?: string) => void;
  readonly addOpenFrame: (
    frameId?: string,
    sessionId?: number,
    route?: string,
  ) => string | undefined;
  readonly closeOpenFrame: (id: string) => void;
  readonly setActiveOpenFrameId: (id: string) => void;
  readonly updateOpenFrame: (id: string, patch: Partial<Omit<OpenFrame, 'id'>>) => void;
  readonly initOpenFrames: (
    projectId?: string,
    initialRoute?: string,
    initialSessionId?: number,
  ) => void;
};

/** Tailwind major to send with a placement; none without one (WP-2.12a section 3.3). */
export function placementTailwindMajor(placement: Placement | undefined): 3 | 4 | undefined {
  return placement === undefined ? undefined : useCanvasViewStore.getState().tailwindMajor;
}

const GRID_STORAGE_KEY = 'kumicraft:canvas-grid';

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

const SNAP_STORAGE_KEY = 'kumicraft:canvas-snap';

/** Snapping is on unless the user turned it off. */
export function getStoredSnap(): boolean {
  try {
    return localStorage.getItem(SNAP_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function setStoredSnap(snap: boolean): void {
  try {
    localStorage.setItem(SNAP_STORAGE_KEY, snap ? '1' : '0');
  } catch {
    // Ignore storage errors
  }
}

const DRAFT_STORAGE_PREFIX = 'kumicraft:draft:';

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
    return ZOOM_STEPS.find((s) => s > current + 0.001) ?? MAX_ZOOM;
  }
  const reversed = [...ZOOM_STEPS].reverse();
  return reversed.find((s) => s < current - 0.001) ?? MIN_ZOOM;
}

function updateFrames(frames: readonly Frame[], activeId: string) {
  const exists = frames.some((f) => f.id === activeId);
  return { frames, activeFrameId: exists ? activeId : (frames[0]?.id ?? 'desktop') };
}

const NO_PAN = { x: 0, y: 0 };

function createPanActions(
  set: (
    updater: Partial<CanvasViewState> | ((s: CanvasViewState) => Partial<CanvasViewState>),
  ) => void,
) {
  return {
    panning: false,
    setPanning: (panning: boolean) => {
      set({ panning });
    },
    pan: NO_PAN,
    panBy: (dx: number, dy: number) => {
      set((s) => ({ pan: { x: s.pan.x + dx, y: s.pan.y + dy } }));
    },
  };
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
      set({ zoom: 1, pan: NO_PAN });
    },
    zoomFit: () => {
      set({ zoom: 'fit', pan: NO_PAN });
    },
  };
}

/**
 * Drafts open per frame (spec-log #148): frame 1 can show a draft while frame 2 shows a page.
 * `draftFile` is the draft of the active frame, the one the Inspector and the panels work on.
 */
function createDraftActions(set: StoreSetter, get: () => CanvasViewState) {
  return {
    openDraft: (file: string, projectId?: string) => {
      const s = get();
      s.updateOpenFrame(s.activeOpenFrameId, { draftFile: file });
      set({ draftFile: file });
      if (projectId) setStoredDraftFile(projectId, file);
    },
    /**
     * Closes the draft of the active frame; with `path` (a deleted draft or folder), closes it in
     * every frame that shows it.
     */
    closeDraft: (projectId?: string, path?: string) => {
      const s = get();
      const shows = (f: OpenFrame) =>
        path === undefined
          ? f.id === s.activeOpenFrameId
          : f.draftFile !== undefined &&
            (f.draftFile === path || f.draftFile.startsWith(`${path}/`));
      for (const frame of s.openFrames.filter(shows)) {
        s.updateOpenFrame(frame.id, { draftFile: undefined });
      }
      const active = get().openFrames.find((f) => f.id === s.activeOpenFrameId);
      set({ draftFile: active?.draftFile });
      if (projectId) setStoredDraftFile(projectId, active?.draftFile);
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

function createModeAndToolActions(
  set: (
    updater: Partial<CanvasViewState> | ((s: CanvasViewState) => Partial<CanvasViewState>),
  ) => void,
  get: () => CanvasViewState,
) {
  return {
    mode: 'design' as const,
    tool: 'select' as const,
    setTool: (tool: DrawTool) => {
      set({ tool, panning: false });
      toolSink?.(tool);
    },
    setMode: (mode: CanvasMode | ((prev: CanvasMode) => CanvasMode)) => {
      const next = typeof mode === 'function' ? mode(get().mode) : mode;
      set(next === 'preview' ? { mode: next, tool: 'select', panning: false } : { mode: next });
      if (next === 'preview') toolSink?.('select');
    },
    toggleMode: () => {
      const next = get().mode === 'design' ? 'preview' : 'design';
      set(next === 'preview' ? { mode: next, tool: 'select', panning: false } : { mode: next });
      if (next === 'preview') toolSink?.('select');
    },
  };
}

function executeAddOpenFrame(
  state: CanvasViewState,
  frameId?: string,
  sessionId?: number,
  route?: string,
) {
  if (state.openFrames.length >= MAX_OPEN_FRAMES) return undefined;
  const { newFrame, nextPreset } = buildNewOpenFrame(
    state.openFrames,
    state.frames,
    state.activeOpenFrameId,
    state.activeFrameId,
    frameId,
    sessionId,
    route,
  );
  return { newFrame, nextPreset, nextList: [...state.openFrames, newFrame] };
}

type StoreSetter = (
  updater: Partial<CanvasViewState> | ((s: CanvasViewState) => Partial<CanvasViewState>),
) => void;

function createInitOpenFrames(set: StoreSetter, get: () => CanvasViewState) {
  return (projectId?: string, initialRoute?: string, initialSessionId?: number) => {
    const s = get();
    const res = initStoredFrames(
      projectId,
      s.activeFrameId,
      initialRoute,
      initialSessionId,
      s.currentProjectId,
    );
    if (res) set(res);
  };
}

function createAddOpenFrame(set: StoreSetter, get: () => CanvasViewState) {
  return (frameId?: string, sessionId?: number, route?: string) => {
    const s = get();
    const res = executeAddOpenFrame(s, frameId, sessionId, route);
    if (!res) return undefined;
    set({
      openFrames: res.nextList,
      activeOpenFrameId: res.newFrame.id,
      activeFrameId: res.nextPreset,
    });
    if (s.currentProjectId) setStoredOpenFrames(s.currentProjectId, res.nextList);
    return res.newFrame.id;
  };
}

function createCloseOpenFrame(set: StoreSetter, get: () => CanvasViewState) {
  return (id: string) => {
    const s = get();
    if (s.openFrames.length <= 1) return;
    const res = resolveCloseTarget(s.openFrames, id, s.activeOpenFrameId, s.activeFrameId);
    set({
      openFrames: res.nextList,
      activeOpenFrameId: res.nextActiveId,
      activeFrameId: res.nextFrameId,
    });
    if (s.currentProjectId) setStoredOpenFrames(s.currentProjectId, res.nextList);
  };
}

function createUpdateOpenFrame(set: StoreSetter, get: () => CanvasViewState) {
  return (id: string, patch: Partial<Omit<OpenFrame, 'id'>>) => {
    const s = get();
    const nextList = s.openFrames.map((f) => (f.id === id ? { ...f, ...patch } : f));
    set({ openFrames: nextList });
    if (s.currentProjectId) setStoredOpenFrames(s.currentProjectId, nextList);
  };
}

function createOpenFrameActions(set: StoreSetter, get: () => CanvasViewState) {
  return {
    openFrames: defaultInitialOpenFrames(),
    activeOpenFrameId: 'default',
    currentProjectId: undefined as string | undefined,
    initOpenFrames: createInitOpenFrames(set, get),
    addOpenFrame: createAddOpenFrame(set, get),
    closeOpenFrame: createCloseOpenFrame(set, get),
    setActiveOpenFrameId: (id: string) => {
      const match = get().openFrames.find((f) => f.id === id);
      // The panels follow the frame: its own draft, or none when it shows a page.
      if (match) {
        set({ activeOpenFrameId: id, activeFrameId: match.frameId, draftFile: match.draftFile });
      }
    },
    updateOpenFrame: createUpdateOpenFrame(set, get),
  };
}

export const useCanvasViewStore = create<CanvasViewState>((set, get) => ({
  ...createModeAndToolActions(set, get),
  zoom: 'fit',
  displayedZoom: 1,
  activeFrameId: 'desktop',
  frames: defaultFrames('desktop-first').frames,
  grid: getStoredGrid(),
  setGrid: (grid) => {
    setStoredGrid(grid);
    set({ grid });
  },
  snap: getStoredSnap(),
  setSnap: (snap) => {
    setStoredSnap(snap);
    set({ snap });
  },
  ...createProjectFactActions(set),
  ...createOpenFrameActions(set, get),
  setZoom: (zoom) => {
    set({ zoom });
  },
  setDisplayedZoom: (displayedZoom) => {
    set({ displayedZoom });
  },
  ...createZoomActions(set),
  ...createPanActions(set),
  setActiveFrameId: (activeFrameId) => {
    const { activeOpenFrameId, openFrames, currentProjectId } = get();
    const nextList = openFrames.map((f) =>
      f.id === activeOpenFrameId ? { ...f, frameId: activeFrameId } : f,
    );
    set({ activeFrameId, openFrames: nextList });
    if (currentProjectId) setStoredOpenFrames(currentProjectId, nextList);
  },
  setFrames: (frames) => {
    if (frames.length > 0) set((s) => updateFrames(frames, s.activeFrameId));
  },
  selectFrameByIndex: (index) => {
    const { frames } = get();
    const target = frames[index];
    if (target) {
      get().setActiveFrameId(target.id);
      return true;
    }
    return false;
  },
  draftFile: undefined,
  ...createDraftActions(set, get),
}));
