// Canvas navigation with the mouse, the way design tools (and AutoCAD) do it:
// - Ctrl + wheel, or a touchpad pinch, zooms around the pointer, over a frame too;
// - holding the wheel button and dragging pans, over a frame too;
// - a plain wheel over the empty Canvas pans (Shift: sideways); over a frame it scrolls the page;
// - with the Pan tool on, a plain wheel zooms, since the page takes no input then.
// Over a frame the page gets the pointer, so the Bridge forwards those gestures (canvas-input.ts).
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

import { MAX_ZOOM, MIN_ZOOM, useCanvasViewStore } from './canvas-view-store.ts';

type Point = { readonly x: number; readonly y: number };
type ZoomRequest = Point & { readonly deltaY: number };
type PanRequest = { readonly phase: 'start' | 'move' | 'end'; readonly screen: Point };

const zoomListeners = new Set<(request: ZoomRequest) => void>();
const panListeners = new Set<(request: PanRequest) => void>();

/** A Ctrl + wheel the Bridge saw inside a frame, already placed in Studio coordinates. */
export function requestCanvasZoom(request: ZoomRequest): void {
  for (const listener of zoomListeners) listener(request);
}

/** A middle-button drag the Bridge saw inside a frame, in screen pixels. */
export function requestCanvasPan(request: PanRequest): void {
  for (const listener of panListeners) listener(request);
}

/** Listens to zooms the Bridge forwards; returns the removal. */
export function onCanvasZoom(listener: (request: ZoomRequest) => void): () => void {
  zoomListeners.add(listener);
  return () => {
    zoomListeners.delete(listener);
  };
}

/** Listens to pans the Bridge forwards; returns the removal. */
export function onCanvasPan(listener: (request: PanRequest) => void): () => void {
  panListeners.add(listener);
  return () => {
    panListeners.delete(listener);
  };
}

/** About ×1.16 per wheel notch (100 px); a pinch sends small steps and zooms smoothly. */
export function zoomAfterWheel(current: number, deltaY: number): number {
  const next = current * Math.exp(-deltaY * 0.0015);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
}

/** The zoomed frame box under the point, or the nearest one: it scales exactly with the zoom. */
function anchorBox(root: HTMLElement, point: Point): HTMLElement | undefined {
  let best: { readonly el: HTMLElement; readonly distance: number } | undefined;
  for (const el of root.querySelectorAll<HTMLElement>('[data-testid="canvas-zoom-box"]')) {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - point.x, 0, point.x - r.right);
    const dy = Math.max(r.top - point.y, 0, point.y - r.bottom);
    const distance = dx * dx + dy * dy;
    if (best === undefined || distance < best.distance) best = { el, distance };
  }
  return best?.el;
}

/** True when the wheel should scroll something inside the Canvas (a log, a list) instead. */
function insideScrollable(target: unknown, root: HTMLElement): boolean {
  let el = target instanceof Element ? target : undefined;
  while (el !== undefined && el !== root) {
    if (el instanceof HTMLElement && el.dataset['testid'] !== 'canvas-placeholder') {
      const style = getComputedStyle(el);
      const scrolls = /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
      if (scrolls) return true;
    }
    el = el.parentElement ?? undefined;
  }
  return false;
}

type Anchor = { readonly box: HTMLElement; readonly at: Point; readonly local: Point };

/** Keeps the point under the pointer still across a zoom, whatever centring the layout does. */
function useZoomAnchor(root: RefObject<HTMLElement | undefined>, zoom: number) {
  const pending = useRef<Anchor>(undefined);
  const panBy = useCanvasViewStore((s) => s.panBy);
  const setZoom = useCanvasViewStore((s) => s.setZoom);

  useLayoutEffect(() => {
    const anchor = pending.current;
    if (anchor === undefined) return;
    pending.current = undefined;
    const r = anchor.box.getBoundingClientRect();
    panBy(
      anchor.at.x - (r.left + anchor.local.x * zoom),
      anchor.at.y - (r.top + anchor.local.y * zoom),
    );
  }, [zoom, panBy]);

  return (at: Point, deltaY: number) => {
    const next = zoomAfterWheel(zoom, deltaY);
    if (next === zoom) return;
    const box = root.current === undefined ? undefined : anchorBox(root.current, at);
    if (box !== undefined) {
      const r = box.getBoundingClientRect();
      pending.current = { box, at, local: { x: (at.x - r.left) / zoom, y: (at.y - r.top) / zoom } };
    }
    setZoom(next);
  };
}

/** Drag deltas from a stream of points (the middle button, here or forwarded by the Bridge). */
function useDragPan() {
  const panBy = useCanvasViewStore((s) => s.panBy);
  const last = useRef<Point>(undefined);
  return (phase: PanRequest['phase'], point: Point) => {
    const from = last.current;
    if (phase === 'move' && from !== undefined) panBy(point.x - from.x, point.y - from.y);
    last.current = phase === 'end' ? undefined : point;
  };
}

type Gestures = {
  readonly zoomAt: (at: Point, deltaY: number) => void;
  readonly drag: (phase: PanRequest['phase'], point: Point) => void;
  readonly panBy: (dx: number, dy: number) => void;
  readonly panning: boolean;
};

/** Adds the wheel and middle-button listeners to `el`; returns their removal. */
function listenGestures(el: HTMLElement, latest: { readonly current: Gestures }): () => void {
  const onWheel = (e: WheelEvent) => {
    const now = latest.current;
    if (e.ctrlKey || e.metaKey || now.panning) {
      e.preventDefault();
      now.zoomAt({ x: e.clientX, y: e.clientY }, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY);
      return;
    }
    if (insideScrollable(e.target, el)) return;
    e.preventDefault();
    if (e.shiftKey) now.panBy(-(e.deltaX || e.deltaY), 0);
    else now.panBy(-e.deltaX, -e.deltaY);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    latest.current.drag('start', { x: e.clientX, y: e.clientY });
  };
  const onMove = (e: PointerEvent) => {
    if (el.hasPointerCapture(e.pointerId))
      latest.current.drag('move', { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: PointerEvent) => {
    if (e.button === 1) latest.current.drag('end', { x: e.clientX, y: e.clientY });
  };
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
  };
}

/** Wires the gestures on the Canvas area `root` (the viewport and the Pan tool surface). */
export function useCanvasNavigation(root: RefObject<HTMLElement | undefined>, zoom: number): void {
  const zoomAt = useZoomAnchor(root, zoom);
  const drag = useDragPan();
  const panBy = useCanvasViewStore((s) => s.panBy);
  const panning = useCanvasViewStore((s) => s.panning);
  const latest = useRef<Gestures>({ zoomAt, drag, panBy, panning });
  useEffect(() => {
    latest.current = { zoomAt, drag, panBy, panning };
  });

  useEffect(() => {
    const el = root.current;
    if (el === undefined) return undefined;
    const stop = listenGestures(el, latest);
    const offZoom = onCanvasZoom((r) => {
      latest.current.zoomAt(r, r.deltaY);
    });
    const offPan = onCanvasPan((r) => {
      latest.current.drag(r.phase, r.screen);
    });
    return () => {
      stop();
      offZoom();
      offPan();
    };
  }, [root]);
}
