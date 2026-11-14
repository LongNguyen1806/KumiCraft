// Canvas Direct Text Editing controller (SPEC-04 section 10 M-TX, R-TX-01..08).
import type { ElementRef } from '@kumicraft/shared';

import { readSelectionInElement, type SelectionInElement } from './text-select.ts';

export type TextEditCallbacks = {
  readonly onCommit: (ref: ElementRef, text: string, runIndex?: number) => void;
  readonly onCancel: (ref: ElementRef, runIndex?: number) => void;
  readonly onStart?: (el: HTMLElement) => void;
  readonly onEnd?: () => void;
  readonly onSelectRange?: (ref: ElementRef, range: SelectionInElement) => void;
};

/** Significant direct child text nodes inside an element (matching AST JSXText runs, TK-78). */
function directTextChildren(el: Element): Text[] {
  return Array.from(el.childNodes).filter(
    (n): n is Text => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
  );
}

/** Identifies which mixed-text run index contains `(clientX, clientY)` on double-click (TK-78). */
export function findClickedTextRunIndex(
  el: Element,
  clientX: number,
  clientY: number,
): number | undefined {
  if (el.children.length === 0) return undefined;
  const textNodes = directTextChildren(el);
  if (textNodes.length === 0) return undefined;
  const doc = el.ownerDocument;
  for (let i = 0; i < textNodes.length; i++) {
    const t = textNodes[i];
    if (!t) continue;
    const range = doc.createRange();
    range.selectNodeContents(t);
    const rects = range.getClientRects();
    for (const rect of rects.length > 0 ? Array.from(rects) : [range.getBoundingClientRect()]) {
      if (
        clientX >= rect.left - 4 &&
        clientX <= rect.right + 4 &&
        clientY >= rect.top - 4 &&
        clientY <= rect.bottom + 4
      ) {
        return i;
      }
    }
  }
  return undefined;
}

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
  private activeRunIndex: number | undefined;
  private activeTextNode: Text | undefined;
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

  public start(element: HTMLElement, ref: ElementRef, runIndex?: number): void {
    if (this.activeElement !== undefined) {
      this.commit();
    }

    const textNode = runIndex !== undefined ? directTextChildren(element)[runIndex] : undefined;
    this.activeElement = element;
    this.activeRef = ref;
    this.activeRunIndex = textNode !== undefined ? runIndex : undefined;
    this.activeTextNode = textNode;
    this.originalText = textNode !== undefined ? textNode.data : element.textContent;
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
    this.selectAllText(element, textNode);
    this.attachListeners(element);
    this.callbacks.onStart?.(element);
  }

  private selectAllText(element: HTMLElement, textNode?: Text): void {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      if (textNode !== undefined) range.selectNodeContents(textNode);
      else range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private attachListeners(element: HTMLElement): void {
    element.addEventListener('keydown', this.handleKeyDown, true);
    element.addEventListener('compositionstart', this.handleCompositionStart);
    element.addEventListener('compositionend', this.handleCompositionEnd);
    element.ownerDocument.addEventListener('selectionchange', this.handleSelectionChange);
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
      this.activeElement.ownerDocument.removeEventListener(
        'selectionchange',
        this.handleSelectionChange,
      );
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
    const runIndex = this.activeRunIndex;
    const textNode = this.activeTextNode;
    const orig = this.originalText ?? '';
    // The source text: innerText would bring CSS in (`uppercase` wrote `BOSE KCQA`, K9.5).
    const rawText =
      textNode !== undefined ? (textNode.isConnected ? textNode.data : '') : el.textContent;

    this.cleanUp();
    this.activeElement = undefined;
    this.activeRef = undefined;
    this.activeRunIndex = undefined;
    this.activeTextNode = undefined;
    this.originalText = undefined;

    const normalizedNew = normalizeText(rawText);
    const normalizedOld = normalizeText(orig);

    if (normalizedNew === normalizedOld) {
      if (runIndex !== undefined) this.callbacks.onCancel(ref, runIndex);
      else this.callbacks.onCancel(ref);
    } else {
      if (runIndex !== undefined) this.callbacks.onCommit(ref, normalizedNew, runIndex);
      else this.callbacks.onCommit(ref, normalizedNew);
    }

    this.callbacks.onEnd?.();
  }

  public cancel(): void {
    if (this.activeElement === undefined || this.activeRef === undefined) {
      return;
    }

    const el = this.activeElement;
    const ref = this.activeRef;
    const runIndex = this.activeRunIndex;
    const textNode = this.activeTextNode;
    const orig = this.originalText ?? '';

    this.cleanUp();
    this.activeElement = undefined;
    this.activeRef = undefined;
    this.activeRunIndex = undefined;
    this.activeTextNode = undefined;
    this.originalText = undefined;

    if (textNode !== undefined) {
      textNode.textContent = orig;
    } else {
      el.textContent = orig;
    }
    if (runIndex !== undefined) this.callbacks.onCancel(ref, runIndex);
    else this.callbacks.onCancel(ref);
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

  private handleSelectionChange = (): void => {
    if (this.activeElement === undefined || this.activeRef === undefined || this.isComposing)
      return;
    const range = readSelectionInElement(this.activeElement);
    if (range !== undefined) {
      this.callbacks.onSelectRange?.(this.activeRef, range);
    }
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
