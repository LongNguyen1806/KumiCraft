// Temporary inline styles that preview a free move or resize until the source edit lands (R-FF-13, R-FF-14).
import type { Box } from './free-geometry.ts';

type Saved = { left: string; top: string; width: string; height: string };

/** How long a released preview may wait for the class change written by Studio. */
const HOLD_TIMEOUT_MS = 3000;

export class PreviewStyles {
  private readonly saved = new Map<HTMLElement, Saved>();
  private readonly holds = new Map<HTMLElement, () => void>();

  /** Shows `box` fields as inline px styles; the element's own inline values are kept to restore. */
  public apply(el: HTMLElement, box: Partial<Box>): void {
    this.dropHold(el);
    if (!this.saved.has(el)) {
      const { left, top, width, height } = el.style;
      this.saved.set(el, { left, top, width, height });
    }
    if (box.left !== undefined) el.style.left = `${String(box.left)}px`;
    if (box.top !== undefined) el.style.top = `${String(box.top)}px`;
    if (box.width !== undefined) el.style.width = `${String(box.width)}px`;
    if (box.height !== undefined) el.style.height = `${String(box.height)}px`;
  }

  /** Puts the element's inline styles back as they were (Esc, or the edit has landed). */
  public restore(el: HTMLElement): void {
    this.dropHold(el);
    const saved = this.saved.get(el);
    if (saved === undefined) return;
    this.saved.delete(el);
    el.style.left = saved.left;
    el.style.top = saved.top;
    el.style.width = saved.width;
    el.style.height = saved.height;
  }

  /**
   * Keeps the preview after release so the element does not jump back while the file is written,
   * then restores it once the new classes arrive (or after a timeout if nothing changes).
   */
  public holdUntilClassChange(el: HTMLElement): void {
    if (!this.saved.has(el)) return;
    this.dropHold(el);
    const observer = new MutationObserver(() => {
      this.restore(el);
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    const timer = setTimeout(() => {
      this.restore(el);
    }, HOLD_TIMEOUT_MS);
    this.holds.set(el, () => {
      observer.disconnect();
      clearTimeout(timer);
    });
  }

  public restoreAll(): void {
    for (const el of [...this.saved.keys()]) this.restore(el);
  }

  private dropHold(el: HTMLElement): void {
    const stop = this.holds.get(el);
    if (stop === undefined) return;
    this.holds.delete(el);
    stop();
  }
}
