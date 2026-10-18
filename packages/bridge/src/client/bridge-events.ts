// Captured DOM events for the Bridge in design mode (SPEC-04 R-BR-11, R-BR-14).

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
