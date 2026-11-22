// One frame at a time (owner 2026-11-06, like a presentation view): with two or more frames the
// Canvas can show only the working frame, full size, and step to the one before or after. Every
// frame stays mounted while hidden, so switching never reloads a page or loses its sign-in.
import { create } from 'zustand';

import { useCanvasViewStore } from './canvas-view-store.ts';

const storageKey = (projectId: string) => `kumicraft.frameFocus.${projectId}`;

type FrameFocusState = {
  /** The user chose "one frame at a time"; it only shows while two or more frames are open. */
  readonly focus: boolean;
  /** Which way the last step went, for the slide: -1 back, 1 forward, 0 no step. */
  readonly direction: -1 | 0 | 1;
  readonly projectId?: string | undefined;
  readonly load: (projectId: string | undefined) => void;
  readonly setFocus: (focus: boolean) => void;
  readonly setDirection: (direction: -1 | 0 | 1) => void;
};

function readFocus(projectId: string | undefined): boolean {
  if (projectId === undefined) return false;
  try {
    return localStorage.getItem(storageKey(projectId)) === '1';
  } catch {
    return false;
  }
}

export const useFrameFocusStore = create<FrameFocusState>((set, get) => ({
  focus: false,
  direction: 0,
  projectId: undefined,
  load: (projectId) => {
    if (projectId === get().projectId) return;
    set({ projectId, focus: readFocus(projectId), direction: 0 });
  },
  setFocus: (focus) => {
    const { projectId } = get();
    try {
      if (projectId !== undefined) localStorage.setItem(storageKey(projectId), focus ? '1' : '0');
    } catch {
      // Storage blocked: the choice lasts until the tab closes.
    }
    set({ focus, direction: 0 });
  },
  setDirection: (direction) => {
    set({ direction });
  },
}));

/** "One frame at a time" is on and there is more than one frame to step through. */
export function useFrameFocusActive(): boolean {
  const focus = useFrameFocusStore((s) => s.focus);
  const count = useCanvasViewStore((s) => s.openFrames.length);
  return focus && count >= 2;
}

function isFocusActive(): boolean {
  return (
    useFrameFocusStore.getState().focus && useCanvasViewStore.getState().openFrames.length >= 2
  );
}

/** Shows only this frame, full size. */
export function focusFrame(openFrameId: string): void {
  const canvas = useCanvasViewStore.getState();
  if (canvas.openFrames.length < 2) return;
  canvas.setActiveOpenFrameId(openFrameId);
  useFrameFocusStore.getState().setFocus(true);
  canvas.zoomFit();
}

/** Side by side again. Returns false when there was nothing to leave (Esc then does nothing). */
export function exitFrameFocus(): boolean {
  if (!isFocusActive()) return false;
  useFrameFocusStore.getState().setFocus(false);
  useCanvasViewStore.getState().zoomFit();
  return true;
}

/** Shift+2 and the switch in the status bar. */
export function toggleFrameFocus(): boolean {
  const canvas = useCanvasViewStore.getState();
  if (canvas.openFrames.length < 2) return false;
  useFrameFocusStore.getState().setFocus(!useFrameFocusStore.getState().focus);
  canvas.zoomFit();
  return true;
}

/**
 * The frame before (-1) or after (1) becomes the working one; no wrap-around, so the ends are
 * clear. One frame at a time, the Canvas fits the new frame and slides that way.
 */
export function stepFrame(step: -1 | 1): boolean {
  const canvas = useCanvasViewStore.getState();
  const index = canvas.openFrames.findIndex((f) => f.id === canvas.activeOpenFrameId);
  const next = canvas.openFrames[index + step];
  if (index < 0 || next === undefined) return false;
  canvas.setActiveOpenFrameId(next.id);
  if (isFocusActive()) {
    useFrameFocusStore.getState().setDirection(step);
    canvas.zoomFit();
  }
  return true;
}
