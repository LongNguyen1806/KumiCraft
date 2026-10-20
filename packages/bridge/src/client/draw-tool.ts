// Canvas drawing tools: Frame (F), Text (T), Image (I) (SPEC-04 section 18B, R-DT-10..R-DT-15).
import {
  type BridgeDrawEndPayload,
  type DrawTool,
  type ElementGuard,
  type InsertTarget,
  parseLocString,
  snap,
} from '@reactcraft/shared';

import { getCandidateChain } from './candidate-chain.ts';
import { canContain, type DropRect } from './drop-target.ts';
import {
  directLocChildren,
  type GridSize,
  isFreeFrame,
  type Measure,
  type Point,
  pointInFrame,
  viewportMeasure,
} from './free-frame/free-geometry.ts';
import { focusRoots } from './overlay-focus.ts';

const MIN_DRAW_SIZE_PX = 8;
const MAX_DRAW_SIZE_PX = 4096;
const MAX_CONTAINER_WIDTH_PX = 16384;

function guardOf(el: Element): ElementGuard {
  return {
    loc: el.getAttribute('data-rc-loc') ?? '',
    tag: el.localName,
  };
}

function sameSourceFile(a: Element, b: Element): boolean {
  const aLoc = a.getAttribute('data-rc-loc');
  const bLoc = b.getAttribute('data-rc-loc');
  if (!aLoc || !bLoc) return false;
  const aFile = parseLocString(aLoc)?.file;
  const bFile = parseLocString(bLoc)?.file;
  return aFile !== undefined && aFile === bFile;
}

function computeContainerWidth(container: Element, measure: Measure): number {
  const base = container.clientWidth > 0 ? container.clientWidth : measure(container).width;
  const style = container.ownerDocument.defaultView?.getComputedStyle(container);
  const padLeft = style ? Number.parseFloat(style.paddingLeft) || 0 : 0;
  const padRight = style ? Number.parseFloat(style.paddingRight) || 0 : 0;
  return Math.min(MAX_CONTAINER_WIDTH_PX, Math.max(0, Math.round(base - padLeft - padRight)));
}

/**
 * Finds the nearest container with `data-rc-loc` at `start` that satisfies `canContain` (rejecting
 * void/leaf tags and elements with direct text like `<p>Hello</p>`). Falls back to the design file
 * root or the first `[data-rc-loc]` container in `body`.
 */
export function findDrawContainer(
  doc: Document,
  start: Point,
  designFile?: string,
): Element | undefined {
  const hits =
    typeof doc.elementsFromPoint === 'function'
      ? doc
          .elementsFromPoint(start.x, start.y)
          .filter((el) => el.id !== '__rc_overlay_host' && !el.closest('#__rc_overlay_host'))
      : [];
  let deepest: Element | undefined;
  for (const raw of hits) {
    const locEl = raw.closest('[data-rc-loc]') ?? undefined;
    if (locEl !== undefined) {
      deepest = locEl;
      break;
    }
  }
  if (deepest !== undefined) {
    const chain = getCandidateChain(deepest);
    for (let i = chain.length - 1; i >= 0; i--) {
      const candidate = chain[i];
      if (candidate !== undefined && canContain(candidate)) return candidate;
    }
  }
  if (designFile !== undefined) {
    const root = focusRoots(doc, designFile).find((el) => canContain(el));
    if (root !== undefined) return root;
  }
  return Array.from(doc.querySelectorAll('[data-rc-loc]')).find((el) => canContain(el));
}

/**
 * Computes the insertion target inside `container` for a draw starting at `start` (R-DT-11..14, R-DD-12).
 */
export function drawTarget(
  container: Element,
  start: Point,
  measure: Measure = viewportMeasure,
): InsertTarget {
  const parentGuard = guardOf(container);
  if (isFreeFrame(container)) {
    return { kind: 'child', parent: parentGuard, where: 'end' };
  }
  const firstBelow = directLocChildren(container).find((child) => {
    const r = measure(child);
    return r.y + r.height / 2 > start.y;
  });
  if (firstBelow !== undefined && sameSourceFile(container, firstBelow)) {
    return { kind: 'sibling', ref: guardOf(firstBelow), where: 'before' };
  }
  return { kind: 'child', parent: parentGuard, where: 'end' };
}

/**
 * Builds the `draw-end` payload from the press and release points (R-DT-11..14).
 */
export function buildDrawEnd(
  tool: 'frame' | 'text' | 'image',
  container: Element,
  start: Point,
  end: Point,
  grid: GridSize,
  measure: Measure = viewportMeasure,
): BridgeDrawEndPayload {
  const rawWidth = Math.round(Math.abs(end.x - start.x));
  const rawHeight = Math.round(Math.abs(end.y - start.y));
  const hasSize = tool !== 'text' && rawWidth >= MIN_DRAW_SIZE_PX && rawHeight >= MIN_DRAW_SIZE_PX;
  const size = hasSize
    ? {
        width: Math.min(MAX_DRAW_SIZE_PX, rawWidth),
        height: Math.min(MAX_DRAW_SIZE_PX, rawHeight),
      }
    : undefined;
  const target = drawTarget(container, start, measure);
  const containerWidth = computeContainerWidth(container, measure);

  if (!isFreeFrame(container)) {
    return {
      tool,
      target,
      ...(size !== undefined ? { size } : {}),
      containerWidth,
    };
  }

  const topLeft =
    tool === 'text' ? start : { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) };
  const pt = pointInFrame(container, topLeft, measure);
  const placement = {
    kind: 'free' as const,
    left: snap(pt.x, grid),
    top: snap(pt.y, grid),
    ...(size !== undefined ? { width: size.width, height: size.height } : {}),
  };
  return {
    tool,
    target,
    ...(size !== undefined ? { size } : {}),
    containerWidth,
    placement,
  };
}

export type DrawCallbacks = {
  sendDrawEnd: (payload: BridgeDrawEndPayload) => void;
  showDrawRect: (rect: DropRect | undefined) => void;
};

type DrawSession = {
  tool: 'frame' | 'text' | 'image';
  container: Element;
  start: Point;
};

export class DrawController {
  private readonly cb: DrawCallbacks;
  private readonly win: Window;
  private readonly measure: Measure;
  private readonly getGrid: () => GridSize;
  private readonly getDesignFile: () => string | undefined;
  private tool: DrawTool = 'select';
  private session: DrawSession | undefined;
  private suppressClick = false;

  constructor(
    cb: DrawCallbacks,
    win: Window,
    measure: Measure = viewportMeasure,
    getGrid: () => GridSize = () => 8,
    getDesignFile: () => string | undefined = () => undefined,
  ) {
    this.cb = cb;
    this.win = win;
    this.measure = measure;
    this.getGrid = getGrid;
    this.getDesignFile = getDesignFile;
  }

  public getTool(): DrawTool {
    return this.tool;
  }

  public isActive(): boolean {
    return this.tool !== 'select';
  }

  public isDragging(): boolean {
    return this.session !== undefined;
  }

  public setTool(tool: DrawTool): void {
    this.cancel();
    this.tool = tool;
    this.win.document.documentElement.style.cursor = tool === 'select' ? '' : 'crosshair';
  }

  public consumeClickSuppression(): boolean {
    if (!this.suppressClick) return false;
    this.suppressClick = false;
    return true;
  }

  public begin(x: number, y: number, doc: Document = this.win.document): boolean {
    if (this.tool === 'select') return false;
    const start = { x, y };
    const container = findDrawContainer(doc, start, this.getDesignFile());
    if (container === undefined) return false;
    this.cancel();
    this.session = { tool: this.tool, container, start };
    this.win.addEventListener('pointermove', this.handlePointerMove, true);
    this.win.addEventListener('pointerup', this.handlePointerUp, true);
    this.win.addEventListener('pointercancel', this.handlePointerCancel, true);
    return true;
  }

  /** Esc while dragging cancels the draw session without changing the active tool. */
  public escape(): boolean {
    if (this.session === undefined) return false;
    this.cancel();
    return true;
  }

  public cancel(): void {
    if (this.session === undefined) return;
    this.session = undefined;
    this.cb.showDrawRect(undefined);
    this.win.removeEventListener('pointermove', this.handlePointerMove, true);
    this.win.removeEventListener('pointerup', this.handlePointerUp, true);
    this.win.removeEventListener('pointercancel', this.handlePointerCancel, true);
  }

  public destroy(): void {
    this.cancel();
    this.win.document.documentElement.style.cursor = '';
  }

  private handlePointerCancel = (): void => {
    this.cancel();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const s = this.session;
    if (s === undefined || s.tool === 'text') return;
    this.cb.showDrawRect({
      x: Math.min(s.start.x, event.clientX),
      y: Math.min(s.start.y, event.clientY),
      width: Math.abs(event.clientX - s.start.x),
      height: Math.abs(event.clientY - s.start.y),
    });
  };

  private handlePointerUp = (event: PointerEvent): void => {
    const s = this.session;
    if (s === undefined) return;
    this.cancel();
    this.suppressClick = true;
    const end = s.tool === 'text' ? s.start : { x: event.clientX, y: event.clientY };
    this.cb.sendDrawEnd(
      buildDrawEnd(s.tool, s.container, s.start, end, this.getGrid(), this.measure),
    );
  };
}
