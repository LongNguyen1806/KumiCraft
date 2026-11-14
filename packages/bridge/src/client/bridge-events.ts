// Captured DOM events for the Bridge in design mode (SPEC-04 R-BR-11, R-BR-14).
import { toBuildError } from './build-error.ts';
import { attachCanvasInput } from './canvas-input.ts';
import { measureSince } from './perf-marks.ts';

/** The part of Vite's `import.meta.hot` the Bridge uses (R-BR-17). */
export type HotContext = { on(event: string, callback: (payload: unknown) => void): void };

export type BridgeRuntimeConfig = {
  readonly nonce: string;
  readonly studioOrigin: string;
  /** Absolute root of the project, to report build errors with project-relative paths. */
  readonly rootDir: string;
  readonly hot?: HotContext | undefined;
  readonly navigation?: 'history' | 'document' | undefined;
};

export const INTERCEPTED_EVENTS = [
  'pointerdown',
  'pointerup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'submit',
  'dragstart',
] as const;

export function isOverlayHost(target: unknown): boolean {
  return target instanceof Element && target.id === '__rc_overlay_host';
}

export function shortcutPayload(event: KeyboardEvent) {
  return {
    key: event.key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey,
  };
}

export function navigateCanvasRoute(route: string, mode: 'history' | 'document'): void {
  if (mode === 'document') {
    window.location.assign(route);
    return;
  }
  window.history.pushState(undefined, '', route);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function revealSelectedElement(loc: string, index: number): void {
  const el = document.querySelectorAll(`[data-rc-loc="${loc}"]`)[index];
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

export function addWindowListeners(
  interceptedHandler: (event: Event) => void,
  pointerMoveHandler: (event: PointerEvent) => void,
  keyDownHandler: (event: KeyboardEvent) => void,
  scrollOrResizeHandler: () => void,
  sendCanvasInput?: (type: string, payload: unknown) => void,
): () => void {
  // First, so the middle button pans before any selection or drag listener sees it.
  const stopCanvasInput =
    sendCanvasInput === undefined ? undefined : attachCanvasInput(sendCanvasInput);
  for (const evtName of INTERCEPTED_EVENTS) {
    window.addEventListener(evtName, interceptedHandler, true);
  }
  // PB-01: the hover step (hit test, overlay, message) as `kc:hover`, in performance runs only.
  const timedPointerMove = (event: PointerEvent) => {
    const startedAt = performance.now();
    pointerMoveHandler(event);
    measureSince('kc:hover', startedAt);
  };
  window.addEventListener('pointermove', timedPointerMove, true);
  window.addEventListener('keydown', keyDownHandler, true);
  window.addEventListener('scroll', scrollOrResizeHandler, { capture: true, passive: true });
  window.addEventListener('resize', scrollOrResizeHandler);

  return () => {
    stopCanvasInput?.();
    for (const evtName of INTERCEPTED_EVENTS) {
      window.removeEventListener(evtName, interceptedHandler, true);
    }
    window.removeEventListener('pointermove', timedPointerMove, true);
    window.removeEventListener('keydown', keyDownHandler, true);
    window.removeEventListener('scroll', scrollOrResizeHandler, true);
    window.removeEventListener('resize', scrollOrResizeHandler);
  };
}

export function addAltClearListeners(onClear: () => void): () => void {
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Alt') onClear();
  };
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onClear);
  return () => {
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onClear);
  };
}

export function attachViteHmrListeners(
  hot: HotContext | undefined,
  rootDir: string,
  onError: (payload: ReturnType<typeof toBuildError>) => void,
  onUpdate: () => void,
): void {
  if (hot === undefined) return;
  hot.on('vite:error', (payload) => {
    onError(toBuildError(payload, rootDir));
  });
  hot.on('vite:afterUpdate', onUpdate);
}

export function runCanvasEscapeAction(
  event: KeyboardEvent,
  drag: { isDragging(): boolean; cancel(): void },
  tools: { escape(): boolean },
): boolean {
  if (event.key !== 'Escape') return false;
  if (drag.isDragging()) {
    event.preventDefault();
    event.stopPropagation();
    drag.cancel();
    return true;
  }
  if (tools.escape()) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return false;
}

export function trimRuntimeErrorPayload(message: string, stack?: string) {
  return {
    message: message.slice(0, 2000),
    ...(stack !== undefined ? { stack: stack.slice(0, 8000) } : {}),
  };
}

export function isToolClickSwallowed(event: Event, swallowDrawClick: () => boolean): boolean {
  return (
    (event.type === 'click' || event.type === 'dblclick') &&
    (isOverlayHost(event.target) || swallowDrawClick())
  );
}
