// Canvas navigation from inside the page: the Studio never sees the pointer over the frame, so the
// Bridge hands it the gestures that move the Canvas. Ctrl + wheel (and a touchpad pinch, which the
// browser reports as Ctrl + wheel) zooms; holding the wheel button and dragging pans. A plain wheel
// still scrolls the page, as before.

type Send = (type: string, payload: unknown) => void;

/** A pointer position as a 0–1 fraction; the middle when the browser gives none. */
const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;

/** Wheel lines (Firefox) to pixels, so every browser zooms at the same pace. */
const LINE_PX = 16;

function wheelPixels(event: WheelEvent): number {
  return event.deltaMode === 1 ? event.deltaY * LINE_PX : event.deltaY;
}

/** Adds one listener to the page window and returns its removal. */
function on<K extends keyof WindowEventMap>(
  type: K,
  fn: (event: WindowEventMap[K]) => void,
  options: boolean | AddEventListenerOptions,
): () => void {
  window.addEventListener(type, fn, options);
  return () => {
    window.removeEventListener(type, fn, options);
  };
}

/** Listens on the page window; returns the teardown. Install before the other Bridge listeners. */
export function attachCanvasInput(send: Send): () => void {
  let panPointer: number | undefined;

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    // Without this the browser zooms the whole page inside the frame.
    event.preventDefault();
    send('canvas-zoom', {
      deltaY: Math.max(-10_000, Math.min(10_000, wheelPixels(event))),
      x: clamp01(event.clientX / Math.max(1, window.innerWidth)),
      y: clamp01(event.clientY / Math.max(1, window.innerHeight)),
    });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 1) return;
    // Middle button: no autoscroll, no "open link in new tab", no selection in design mode.
    event.preventDefault();
    event.stopImmediatePropagation();
    panPointer = event.pointerId;
    document.documentElement.setPointerCapture(event.pointerId);
    send('canvas-pan', { phase: 'start', screenX: event.screenX, screenY: event.screenY });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== panPointer) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    send('canvas-pan', { phase: 'move', screenX: event.screenX, screenY: event.screenY });
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== panPointer) return;
    panPointer = undefined;
    event.stopImmediatePropagation();
    send('canvas-pan', { phase: 'end', screenX: event.screenX, screenY: event.screenY });
  };

  // Chromium starts autoscroll and opens links from the mouse events, not the pointer ones.
  const onMiddleMouse = (event: MouseEvent) => {
    if (event.button === 1) event.preventDefault();
  };

  const offs = [
    on('wheel', onWheel, { capture: true, passive: false }),
    on('pointerdown', onPointerDown, true),
    on('pointermove', onPointerMove, true),
    on('pointerup', onPointerEnd, true),
    on('pointercancel', onPointerEnd, true),
    on('mousedown', onMiddleMouse, true),
    on('auxclick', onMiddleMouse, true),
  ];
  return () => {
    for (const off of offs) off();
  };
}
