// Temporary canvas animation replay without editing project source files (K9.7-2 TK-22).
import type { StudioMotionPreviewPayload } from '@kumicraft/shared';

type ActivePreview = {
  readonly timer: ReturnType<typeof setTimeout>;
  readonly addedClasses: readonly string[];
  readonly prevAnimation: string;
};

const ACTIVE = new WeakMap<Element, ActivePreview>();

function clearActivePreview(el: HTMLElement | SVGElement): void {
  const prev = ACTIVE.get(el);
  if (prev === undefined) return;
  clearTimeout(prev.timer);
  for (const cls of prev.addedClasses) {
    el.classList.remove(cls);
  }
  el.style.animation = prev.prevAnimation;
  ACTIVE.delete(el);
}

export function triggerMotionPreview(payload: StudioMotionPreviewPayload, doc: Document): boolean {
  const el = doc.querySelectorAll(`[data-rc-loc="${payload.ref.loc}"]`)[payload.ref.index];
  const view = doc.defaultView ?? window;
  if (!(el instanceof view.HTMLElement || el instanceof view.SVGElement)) return false;

  clearActivePreview(el);
  const prevAnimation = el.style.animation;
  const tokens = (payload.className ?? '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !el.classList.contains(t));

  el.style.animation = 'none';
  void el.getBoundingClientRect();
  el.style.animation = prevAnimation;
  for (const cls of tokens) el.classList.add(cls);

  const duration = payload.durationMs ?? 700;
  const timer = setTimeout(() => {
    clearActivePreview(el);
  }, duration);
  ACTIVE.set(el, { timer, addedClasses: tokens, prevAnimation });
  return true;
}
