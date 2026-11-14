// Responsive audit in the live page DOM: horizontal overflow and sibling overlap (TK-66).
import type { ElementRef, ResponsiveAuditIssue } from '@kumicraft/shared';

const MAX_ISSUES = 200;
const OVERFLOW_EPSILON_PX = 1;
const OVERLAP_RATIO_THRESHOLD = 0.2;

interface LocatedBox {
  readonly el: Element;
  readonly ref: ElementRef;
  readonly tag: string;
  readonly rect: DOMRect;
  readonly position: string;
}

function isHiddenOrEmpty(el: Element, rect: DOMRect, win: Window): boolean {
  if (rect.width <= 0 || rect.height <= 0) return true;
  const style = win.getComputedStyle(el);
  return style.display === 'none' || style.visibility === 'hidden';
}

function isClippedHorizontally(el: Element, doc: Document, win: Window): boolean {
  for (
    let node = el.parentElement ?? undefined;
    node !== undefined && node !== doc.documentElement;
    node = node.parentElement ?? undefined
  ) {
    const ox = win.getComputedStyle(node).overflowX;
    if (ox === 'hidden' || ox === 'clip' || ox === 'scroll' || ox === 'auto') {
      return true;
    }
  }
  return false;
}

function collectLocatedBoxes(doc: Document, win: Window): LocatedBox[] {
  const counts = new Map<string, number>();
  const boxes: LocatedBox[] = [];
  for (const el of doc.querySelectorAll('[data-rc-loc]')) {
    const loc = el.getAttribute('data-rc-loc') ?? '';
    if (loc === '') continue;
    const index = counts.get(loc) ?? 0;
    counts.set(loc, index + 1);
    const rect = el.getBoundingClientRect();
    if (isHiddenOrEmpty(el, rect, win)) continue;
    const position = win.getComputedStyle(el).position;
    boxes.push({
      el,
      ref: { loc, index },
      tag: el.tagName.toLowerCase(),
      rect,
      position,
    });
  }
  return boxes;
}

function overlapRatio(a: DOMRect, b: DOMRect): number {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  if (ix === 0 || iy === 0) return 0;
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? (ix * iy) / minArea : 0;
}

function checkSiblingOverlaps(
  boxes: readonly LocatedBox[],
  viewportWidth: number,
  issues: ResponsiveAuditIssue[],
): void {
  const byParent = new Map<Element, LocatedBox[]>();
  for (const box of boxes) {
    if (box.position === 'absolute' || box.position === 'fixed') continue;
    const parent = box.el.parentElement ?? undefined;
    if (parent === undefined) continue;
    const list = byParent.get(parent);
    if (list === undefined) byParent.set(parent, [box]);
    else list.push(box);
  }
  for (const siblings of byParent.values()) {
    for (let i = 0; i < siblings.length && issues.length < MAX_ISSUES; i++) {
      for (let j = i + 1; j < siblings.length && issues.length < MAX_ISSUES; j++) {
        const a = siblings[i];
        const b = siblings[j];
        if (a === undefined || b === undefined) continue;
        const ratio = overlapRatio(a.rect, b.rect);
        if (ratio > OVERLAP_RATIO_THRESHOLD) {
          issues.push({
            ref: b.ref,
            tag: b.tag,
            kind: 'overlap',
            detail: `${a.tag} ↔ ${b.tag} (${String(Math.round(ratio * 100))}%)`,
            width: Math.round(viewportWidth),
          });
        }
      }
    }
  }
}

export function runResponsiveAudit(doc: Document, win: Window): ResponsiveAuditIssue[] {
  const viewportWidth = doc.documentElement.clientWidth || win.innerWidth;
  if (viewportWidth <= 0) return [];
  const boxes = collectLocatedBoxes(doc, win);
  const issues: ResponsiveAuditIssue[] = [];

  for (const box of boxes) {
    if (issues.length >= MAX_ISSUES) break;
    if (
      (box.rect.right > viewportWidth + OVERFLOW_EPSILON_PX ||
        box.rect.left < -OVERFLOW_EPSILON_PX) &&
      !isClippedHorizontally(box.el, doc, win)
    ) {
      issues.push({
        ref: box.ref,
        tag: box.tag,
        kind: 'overflow',
        detail: `${String(Math.round(box.rect.width))}px / ${String(Math.round(viewportWidth))}px`,
        width: Math.round(viewportWidth),
      });
    }
  }

  checkSiblingOverlaps(boxes, viewportWidth, issues);
  return issues;
}
