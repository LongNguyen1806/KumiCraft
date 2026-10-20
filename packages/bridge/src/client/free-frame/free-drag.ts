// Mouse move and resize of elements on the Canvas, with a live preview and one write on release
// (SPEC-04 section 18E, R-FF-13, R-FF-14).
import type { BridgeFreeMovePayload, BridgeFreeResizePayload } from '@reactcraft/shared';
import { snap } from '@reactcraft/shared';

import { getRefForElement } from '../candidate-chain.ts';
import {
  type Box,
  boxInFrame,
  directLocChildren,
  freeFrameOf,
  type GridSize,
  type Measure,
  viewportMeasure,
} from './free-geometry.ts';
import { PreviewStyles } from './preview-styles.ts';
import { type HandleDir, resizeBox, resizeChanges } from './resize-box.ts';
import { type GapMark, type GuideLine, snapEdge, snapMove } from './smart-guides.ts';

export type FreeDragCallbacks = {
  sendMove: (p: BridgeFreeMovePayload) => void;
  sendResize: (p: BridgeFreeResizePayload) => void;
  /** Live `x · y` or `W × H` label next to `anchor`; `undefined` hides it. */
  showLabel: (text: string | undefined, anchor?: Element) => void;
  showGuides: (lines: readonly GuideLine[], gaps: readonly GapMark[], frame?: Element) => void;
};

type MoveItem = { el: HTMLElement; start: Box; now: Box };
type MoveSession = {
  kind: 'move';
  frame: Element;
  items: MoveItem[];
  others: Box[];
  frameSize: { width: number; height: number };
};
type ResizeSession = {
  kind: 'resize';
  el: HTMLElement;
  dir: HandleDir;
  inFree: boolean;
  frame?: Element | undefined;
  others?: Box[] | undefined;
  frameSize?: { width: number; height: number } | undefined;
  start: Box;
  now: Box;
};
type Session = (MoveSession | ResizeSession) & {
  startX: number;
  startY: number;
  moved: boolean;
};

const MOVE_THRESHOLD_PX = 3;

export class FreeDragController {
  private readonly cb: FreeDragCallbacks;
  private readonly win: Window;
  private readonly measure: Measure;
  private readonly preview = new PreviewStyles();
  private session: Session | undefined;
  private grid: GridSize = 8;
  private suppressClick = false;

  constructor(cb: FreeDragCallbacks, win: Window, measure: Measure = viewportMeasure) {
    this.cb = cb;
    this.win = win;
    this.measure = measure;
  }

  public setGrid(grid: GridSize): void {
    this.grid = grid;
  }

  public getGrid(): GridSize {
    return this.grid;
  }

  public isActive(): boolean {
    return this.session !== undefined;
  }

  public consumeClickSuppression(): boolean {
    if (!this.suppressClick) return false;
    this.suppressClick = false;
    return true;
  }

  /**
   * R-FF-13: a press on a selected element that sits in a free frame starts a move of every selected
   * element of that frame. Returns false (nothing started) for any other press.
   */
  public tryBeginMove(
    target: Element,
    x: number,
    y: number,
    selected: readonly Element[],
  ): boolean {
    const pressed = selected.find((el) => el === target || el.contains(target));
    const frame = pressed === undefined ? undefined : freeFrameOf(pressed);
    if (frame === undefined) return false;
    const items = selected
      .filter((el): el is HTMLElement => el instanceof HTMLElement && freeFrameOf(el) === frame)
      .map((el) => {
        const start = boxInFrame(el, frame, this.measure);
        return { el, start, now: start };
      });
    if (items.length === 0) return false;
    const draggedSet = new Set<Element>(items.map((it) => it.el));
    const others = directLocChildren(frame)
      .filter((c) => !draggedSet.has(c))
      .map((c) => boxInFrame(c, frame, this.measure));
    const r = this.measure(frame);
    const frameSize = {
      width: frame.clientWidth || r.width,
      height: frame.clientHeight || r.height,
    };
    this.begin({
      kind: 'move',
      frame,
      items,
      others,
      frameSize,
      startX: x,
      startY: y,
      moved: false,
    });
    return true;
  }

  /** R-FF-14: a press on a size handle of `el`. */
  public beginResize(el: Element, dir: HandleDir, x: number, y: number): void {
    if (!(el instanceof HTMLElement)) return;
    const frame = freeFrameOf(el);
    const r = this.measure(el);
    const start =
      frame === undefined
        ? { left: 0, top: 0, width: r.width, height: r.height }
        : boxInFrame(el, frame, this.measure);
    let others: Box[] | undefined;
    let frameSize: { width: number; height: number } | undefined;
    if (frame !== undefined) {
      others = directLocChildren(frame)
        .filter((c) => c !== el)
        .map((c) => boxInFrame(c, frame, this.measure));
      const rFrame = this.measure(frame);
      frameSize = {
        width: frame.clientWidth || rFrame.width,
        height: frame.clientHeight || rFrame.height,
      };
    }
    this.begin({
      kind: 'resize',
      el,
      dir,
      inFree: frame !== undefined,
      frame,
      others,
      frameSize,
      start,
      now: start,
      startX: x,
      startY: y,
      moved: false,
    });
  }

  /** R-FF-14: double-click on a handle goes back to the natural size. */
  public resetSize(el: Element): void {
    const ref = getRefForElement(el, el.ownerDocument);
    if (ref !== undefined) this.cb.sendResize({ ref, tag: el.localName, resetSize: true });
  }

  /** Esc or leaving design mode: the element goes back where it was, nothing is written. */
  public cancel(): void {
    if (this.session === undefined) return;
    this.preview.restoreAll();
    this.end();
  }

  public destroy(): void {
    this.cancel();
    this.preview.restoreAll();
  }

  private begin(session: Session): void {
    this.cancel();
    this.session = session;
    this.win.addEventListener('pointermove', this.handlePointerMove, true);
    this.win.addEventListener('pointerup', this.handlePointerUp, true);
    this.win.addEventListener('pointercancel', this.handlePointerCancel, true);
  }

  private end(): void {
    this.session = undefined;
    this.cb.showLabel(undefined);
    this.cb.showGuides([], []);
    this.win.removeEventListener('pointermove', this.handlePointerMove, true);
    this.win.removeEventListener('pointerup', this.handlePointerUp, true);
    this.win.removeEventListener('pointercancel', this.handlePointerCancel, true);
  }

  private handlePointerCancel = (): void => {
    this.cancel();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const s = this.session;
    if (s === undefined) return;
    const dx = event.clientX - s.startX;
    const dy = event.clientY - s.startY;
    if (!s.moved && Math.hypot(dx, dy) < MOVE_THRESHOLD_PX) return;
    s.moved = true;
    if (s.kind === 'move') this.previewMove(s, dx, dy);
    else this.previewResize(s, dx, dy, event.shiftKey);
  };

  private previewMove(s: MoveSession, dx: number, dy: number): void {
    const first = s.items[0];
    if (first === undefined) return;
    const rawLead: Box = {
      left: first.start.left + dx,
      top: first.start.top + dy,
      width: first.start.width,
      height: first.start.height,
    };
    const guide = snapMove(rawLead, s.others, s.frameSize);
    const left = guide.left ?? snap(rawLead.left, this.grid);
    const top = guide.top ?? snap(rawLead.top, this.grid);
    const shiftX = left - first.start.left;
    const shiftY = top - first.start.top;
    for (const item of s.items) {
      const itemLeft = Math.max(0, item.start.left + shiftX);
      const itemTop = Math.max(0, item.start.top + shiftY);
      item.now = { ...item.start, left: itemLeft, top: itemTop };
      this.preview.apply(item.el, { left: item.now.left, top: item.now.top });
    }
    this.cb.showGuides(guide.lines, guide.gaps, s.frame);
    const label = `x ${String(Math.round(first.now.left))} · y ${String(Math.round(first.now.top))}`;
    this.cb.showLabel(label, first.el);
  }

  private previewResize(s: ResizeSession, dx: number, dy: number, ratio: boolean): void {
    let lineX: GuideLine | undefined;
    let lineY: GuideLine | undefined;
    const others = s.others;
    const frameSize = s.frameSize;
    const edgeSnap =
      s.inFree && others !== undefined && frameSize !== undefined
        ? (axis: 'x' | 'y', val: number): number | undefined => {
            const res = snapEdge(axis, val, others, frameSize);
            if (axis === 'x') lineX = res.line;
            else lineY = res.line;
            return res.value;
          }
        : undefined;
    s.now = resizeBox(s.start, s.dir, { dx, dy }, this.grid, ratio, edgeSnap);
    this.preview.apply(s.el, {
      width: s.now.width,
      height: s.now.height,
      ...(s.inFree ? { left: s.now.left, top: s.now.top } : {}),
    });
    const lines: GuideLine[] = [];
    if (lineX !== undefined) lines.push(lineX);
    if (lineY !== undefined) lines.push(lineY);
    this.cb.showGuides(lines, [], s.frame);
    const label = `${String(Math.round(s.now.width))} × ${String(Math.round(s.now.height))}`;
    this.cb.showLabel(label, s.el);
  }

  private handlePointerUp = (): void => {
    const s = this.session;
    if (s === undefined) return;
    this.end();
    if (!s.moved) return;
    this.suppressClick = true;
    if (s.kind === 'move') this.commitMove(s);
    else this.commitResize(s);
  };

  private commitMove(s: MoveSession): void {
    const items = s.items.flatMap((item) => {
      const ref = getRefForElement(item.el, item.el.ownerDocument);
      if (ref === undefined) return [];
      const left = Math.round(item.now.left);
      const top = Math.round(item.now.top);
      return [{ ref, tag: item.el.localName, left, top }];
    });
    if (items.length === 0) {
      this.preview.restoreAll();
      return;
    }
    for (const item of s.items) this.preview.holdUntilClassChange(item.el);
    this.cb.sendMove({ items });
  }

  private commitResize(s: ResizeSession): void {
    const ref = getRefForElement(s.el, s.el.ownerDocument);
    const changes = resizeChanges(s.start, s.now, s.inFree);
    if (ref === undefined || Object.keys(changes).length === 0) {
      this.preview.restore(s.el);
      return;
    }
    this.preview.holdUntilClassChange(s.el);
    this.cb.sendResize({ ref, tag: s.el.localName, ...changes });
  }
}
