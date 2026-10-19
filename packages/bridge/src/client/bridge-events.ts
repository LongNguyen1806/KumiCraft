// Captured DOM events for the Bridge in design mode (SPEC-04 R-BR-11, R-BR-14).

/** The part of Vite's `import.meta.hot` the Bridge uses (R-BR-17). */
export type HotContext = { on(event: string, callback: (payload: unknown) => void): void };

export type BridgeRuntimeConfig = {
  readonly nonce: string;
  readonly studioOrigin: string;
  /** Absolute root of the project, to report build errors with project-relative paths. */
  readonly rootDir: string;
  readonly hot?: HotContext | undefined;
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

export function addWindowListeners(
  interceptedHandler: (event: Event) => void,
  pointerMoveHandler: (event: PointerEvent) => void,
  keyDownHandler: (event: KeyboardEvent) => void,
  scrollOrResizeHandler: () => void,
): () => void {
  for (const evtName of INTERCEPTED_EVENTS) {
    window.addEventListener(evtName, interceptedHandler, true);
  }
  window.addEventListener('pointermove', pointerMoveHandler, true);
  window.addEventListener('keydown', keyDownHandler, true);
  window.addEventListener('scroll', scrollOrResizeHandler, { capture: true, passive: true });
  window.addEventListener('resize', scrollOrResizeHandler);

  return () => {
    for (const evtName of INTERCEPTED_EVENTS) {
      window.removeEventListener(evtName, interceptedHandler, true);
    }
    window.removeEventListener('pointermove', pointerMoveHandler, true);
    window.removeEventListener('keydown', keyDownHandler, true);
    window.removeEventListener('scroll', scrollOrResizeHandler, true);
    window.removeEventListener('resize', scrollOrResizeHandler);
  };
}
