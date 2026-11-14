// Computes normalized UTF-16 selection offsets and viewport rect inside an editable element (K9.7-2 TK-3).
import { normalizeText } from './text-edit.ts';

export type SelectionInElement = {
  readonly start: number;
  readonly end: number;
  readonly rect?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

function normalizePrefix(raw: string): string {
  return raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trimStart();
}

export function readSelectionInElement(el: HTMLElement): SelectionInElement | undefined {
  const doc = el.ownerDocument;
  const sel = doc.defaultView?.getSelection() ?? doc.getSelection();
  if (!sel || sel.rangeCount === 0) return undefined;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return undefined;
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return undefined;

  const full = normalizeText(el.textContent);
  if (full.length === 0) return undefined;

  const rStart = doc.createRange();
  rStart.selectNodeContents(el);
  rStart.setEnd(range.startContainer, range.startOffset);
  const start = Math.min(normalizePrefix(rStart.toString()).length, full.length);

  const rEnd = doc.createRange();
  rEnd.selectNodeContents(el);
  rEnd.setEnd(range.endContainer, range.endOffset);
  const end = Math.min(normalizePrefix(rEnd.toString()).length, full.length);

  if (end <= start) return undefined;

  const box = range.getBoundingClientRect();
  const rect =
    box.width > 0 || box.height > 0
      ? { x: box.left, y: box.top, width: box.width, height: box.height }
      : undefined;
  return rect ? { start, end, rect } : { start, end };
}
