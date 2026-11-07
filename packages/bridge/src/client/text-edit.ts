// Canvas Direct Text Editing controller (SPEC-04 section 10 M-TX, R-TX-01..08).
import type { ElementRef } from '@kumicraft/shared';

export type TextEditCallbacks = {
  readonly onCommit: (ref: ElementRef, text: string) => void;
  readonly onCancel: (ref: ElementRef) => void;
  readonly onStart?: (el: HTMLElement) => void;
  readonly onEnd?: () => void;
};

/**
 * Normalizes text per R-SE-08 & R-TX-04:
 * Replace newlines with spaces, collapse multiple spaces, trim whitespace.
 */
export function normalizeText(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

export class TextEditController {
  private activeElement: HTMLElement | undefined;
  private activeRef: ElementRef | undefined;
  private originalText: string | undefined;
  private isComposing = false;
  private readonly callbacks: TextEditCallbacks;

  constructor(callbacks: TextEditCallbacks) {
    this.callbacks = callbacks;
  }

  public isActive(): boolean {
    return this.activeElement !== undefined;
  }

  public getEditingElement(): HTMLElement | undefined {
    return this.activeElement;
  }

  public start(element: HTMLElement, ref: ElementRef): void {
    if (this.activeElement !== undefined) {
      this.commit();
    }

    this.activeElement = element;
    this.activeRef = ref;
    this.originalText = element.textContent;
    this.isComposing = false;

    try {
      element.contentEditable = 'plaintext-only';
    } catch {
      element.contentEditable = 'true';
    }
    if (element.contentEditable !== 'plaintext-only') {
      element.contentEditable = 'true';
    }

    element.focus();
    this.selectAllText(element);
    this.attachListeners(element);
    this.callbacks.onStart?.(element);
  }

  private selectAllText(element: HTMLElement): void {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private attachListeners(element: HTMLElement): void {
    element.addEventListener('keydown', this.handleKeyDown, true);
    element.addEventListener('compositionstart', this.handleCompositionStart);
    element.addEventListener('compositionend', this.handleCompositionEnd);
    window.addEventListener('pointerdown', this.handleOutsidePointerDown, true);
  }

  /**
   * R-TX-04 & Lesson from WP-1.08:
   * Listeners MUST be detached before removing contenteditable attribute.
   */
  private detachListeners(): void {
    if (this.activeElement !== undefined) {
      this.activeElement.removeEventListener('keydown', this.handleKeyDown, true);
      this.activeElement.removeEventListener('compositionstart', this.handleCompositionStart);
      this.activeElement.removeEventListener('compositionend', this.handleCompositionEnd);
    }
    window.removeEventListener('pointerdown', this.handleOutsidePointerDown, true);
  }

  private cleanUp(): void {
    this.detachListeners();
    if (this.activeElement !== undefined) {
      this.activeElement.removeAttribute('contenteditable');
    }
  }

  public commit(): void {
    if (this.activeElement === undefined || this.activeRef === undefined) {
      return;
    }

    const el = this.activeElement;
    const ref = this.activeRef;
    const orig = this.originalText ?? '';
    // The source text: innerText would bring CSS in (`uppercase` wrote `BOSE KCQA`, K9.5).
    const rawText = el.textContent;

    this.cleanUp();
    this.activeElement = undefined;
    this.activeRef = undefined;
    this.originalText = undefined;

    const normalizedNew = normalizeText(rawText);
    const normalizedOld = normalizeText(orig);

    if (normalizedNew === normalizedOld) {
      this.callbacks.onCancel(ref);
    } else {
      this.callbacks.onCommit(ref, normalizedNew);
    }

    this.callbacks.onEnd?.();
  }

  public cancel(): void {
    if (this.activeElement === undefined || this.activeRef === undefined) {
      return;
    }

    const el = this.activeElement;
    const ref = this.activeRef;
    const orig = this.originalText ?? '';

    this.cleanUp();
    this.activeElement = undefined;
    this.activeRef = undefined;
    this.originalText = undefined;

    el.textContent = orig;
    this.callbacks.onCancel(ref);
    this.callbacks.onEnd?.();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
      return;
    }

    if (event.key === 'Enter') {
      if (this.isComposing) {
        return; // R-TX-08: IME composing, do not end edit
      }
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        return; // R-TX-03: Shift+Enter blocked (single segment only)
      }
      event.preventDefault();
      event.stopPropagation();
      this.commit();
    }
  };

  private handleCompositionStart = (): void => {
    this.isComposing = true;
  };

  private handleCompositionEnd = (): void => {
    this.isComposing = false;
  };

  private handleOutsidePointerDown = (event: PointerEvent): void => {
    const target = event.target instanceof Node ? event.target : undefined;
    if (
      this.activeElement !== undefined &&
      target !== undefined &&
      !this.activeElement.contains(target)
    ) {
      this.commit();
    }
  };

  public destroy(): void {
    this.cancel();
  }
}
