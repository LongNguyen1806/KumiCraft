import type { StudioToggleInteractivePayload } from '@kumicraft/shared';

import { resolveElementsByRefs } from './drag.ts';

/**
 * Toggle open/closed state of `<details>` or `data-kc-interactive` kit components in Design mode.
 * Does not modify user source files.
 */
export function toggleInteractiveElement(
  payload: StudioToggleInteractivePayload,
  doc: Document,
): boolean {
  const el = resolveElementsByRefs([payload.ref], doc)[0];
  if (el === undefined) return false;
  const view = doc.defaultView ?? window;

  if (el instanceof view.HTMLDetailsElement) {
    el.open = payload.open ?? !el.open;
    return true;
  }

  const summaryParent = el.closest('summary')?.parentElement;
  if (summaryParent instanceof view.HTMLDetailsElement) {
    summaryParent.open = payload.open ?? !summaryParent.open;
    return true;
  }

  const interactiveTarget = el.hasAttribute('data-kc-interactive')
    ? el
    : (el.querySelector('[data-kc-interactive]') ??
      el.closest('[data-kc-interactive]') ??
      undefined);
  if (interactiveTarget === undefined) return false;

  if (interactiveTarget instanceof view.HTMLDetailsElement) {
    interactiveTarget.open = payload.open ?? !interactiveTarget.open;
    return true;
  }

  interactiveTarget.dispatchEvent(
    new view.CustomEvent('kumicraft:design-toggle', {
      detail: payload.open !== undefined ? { open: payload.open } : {},
    }),
  );
  return true;
}
