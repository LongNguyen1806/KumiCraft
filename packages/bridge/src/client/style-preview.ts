// Live inline style preview while typing in the Inspector (SPEC-04 M-ST, R-ST-13).
import type {
  BridgeStyleProbePayload,
  ElementRef,
  StudioStyleProbePayload,
} from '@kumicraft/shared';

import { answerStyleProbe } from './style-probe.ts';

type SavedDeclaration = {
  readonly value: string;
  readonly priority: string;
};

export class StylePreview {
  private readonly saved = new Map<HTMLElement | SVGElement, Map<string, SavedDeclaration>>();

  public applyByRef(ref: ElementRef, longhand: string, value: string, doc: Document): void {
    const el = doc.querySelectorAll(`[data-rc-loc="${ref.loc}"]`)[ref.index];
    if (el !== undefined) this.apply(el, longhand, value);
  }

  /**
   * Sets `longhand` to `value !important` on `el` so it wins over Bootstrap `!important` utilities,
   * keeping the element's original inline value and priority on the first call for that pair.
   */
  public apply(el: Element, longhand: string, value: string): void {
    const view = el.ownerDocument.defaultView ?? window;
    if (!(el instanceof view.HTMLElement || el instanceof view.SVGElement)) return;
    let map = this.saved.get(el);
    if (map === undefined) {
      map = new Map();
      this.saved.set(el, map);
    }
    if (!map.has(longhand)) {
      map.set(longhand, {
        value: el.style.getPropertyValue(longhand),
        priority: el.style.getPropertyPriority(longhand),
      });
    }
    el.style.setProperty(longhand, value, 'important');
  }

  /**
   * Runs `read` with the previewed values taken off and puts them back right after, in the same
   * task (no frame is drawn between): a style probe must see the element's own styles, not the
   * preview, or Studio takes the preview for inline style while the user types (K10, macOS CI).
   */
  public withoutPreview<T>(read: () => T): T {
    const shown: [HTMLElement | SVGElement, string, string][] = [];
    for (const [el, map] of this.saved.entries()) {
      for (const [longhand, original] of map.entries()) {
        shown.push([el, longhand, el.style.getPropertyValue(longhand)]);
        if (original.value === '') el.style.removeProperty(longhand);
        else el.style.setProperty(longhand, original.value, original.priority);
      }
    }
    try {
      return read();
    } finally {
      for (const [el, longhand, value] of shown) el.style.setProperty(longhand, value, 'important');
    }
  }

  /** Restores all previewed elements' inline styles to their original state. */
  public clearAll(): void {
    for (const [el, map] of this.saved.entries()) {
      for (const [longhand, original] of map.entries()) {
        if (original.value === '') {
          el.style.removeProperty(longhand);
        } else {
          el.style.setProperty(longhand, original.value, original.priority);
        }
      }
    }
    this.saved.clear();
  }
}

/** The style probe answered with the preview taken off (see `withoutPreview`). */
export function cleanProbe(
  preview: StylePreview,
  request: StudioStyleProbePayload,
  doc: Document,
): BridgeStyleProbePayload {
  return preview.withoutPreview(() => answerStyleProbe(request, doc));
}
