// Live inline style preview while typing in the Inspector (SPEC-04 M-ST, R-ST-13).
import type { ElementRef } from '@kumicraft/shared';

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
