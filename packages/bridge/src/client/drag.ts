// Canvas and Studio drag-and-drop controller (SPEC-04 section 16 M-DD, R-DD-10..17).
import type {
  BridgeDropTargetPayload,
  BridgeMoveIntentPayload,
  ElementRef,
  InsertTarget,
  StudioDragOverPayload,
} from '@reactcraft/shared';

import { type DropCache, type DropEnv, type DropResult, findDropTarget } from './drop-target.ts';

export type DragCallbacks = {
  sendDropTarget: (p: BridgeDropTargetPayload) => void;
  sendMoveIntent: (p: BridgeMoveIntentPayload) => void;
  showIndicator: (d: DropResult | undefined) => void;
};

const DRAG_THRESHOLD_PX = 4;
const AUTO_SCROLL_MARGIN_PX = 40;
const AUTO_SCROLL_STEP_PX = 12;

export function resolveElementsByRefs(refs: readonly ElementRef[], doc: Document): Element[] {
  const result: Element[] = [];
  for (const ref of refs) {
    const el = doc.querySelectorAll(`[data-rc-loc="${ref.loc}"]`)[ref.index];
    if (el) result.push(el);
  }
  return result;
}

/** R-DD-17: 1 element -> it; multiple elements with the same parentElement -> all in DOM order; else []. */
export function normalizeDraggableElements(elements: readonly Element[]): Element[] {
  if (elements.length === 0) return [];
  if (elements.length > 1) {
    const parent = elements[0]?.parentElement;
    if (!parent || elements.some((el) => el.parentElement !== parent)) {
      return [];
    }
  }
  return [...elements].sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));
}

export function computeDragHandleTarget(
  refs: readonly ElementRef[],
  mode: 'design' | 'preview',
  textEditActive: boolean,
  doc: Document,
): Element | undefined {
  if (mode !== 'design' || textEditActive || refs.length === 0) return undefined;
  const elements = resolveElementsByRefs(refs, doc);
  if (elements.length !== refs.length) return undefined;
  const draggable = normalizeDraggableElements(elements);
  if (draggable.length === 0) return undefined;
  return elements[elements.length - 1];
}

export class DragController {
  private readonly env: DropEnv;
  private readonly cb: DragCallbacks;
  private readonly win: Window;
  private mode: 'idle' | 'canvas' | 'studio' = 'idle';
  private dragged: Element[] = [];
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private exceededThreshold = false;
  private currentTarget: InsertTarget | undefined;
  private lastTargetKey = '';
  private cache: DropCache = {};
  private moveRafId: number | undefined;
  private scrollRafId: number | undefined;
  private scrollDelta = 0;
  private suppressClick = false;

  constructor(env: DropEnv, cb: DragCallbacks, win: Window) {
    this.env = env;
    this.cb = cb;
    this.win = win;
    this.win.addEventListener('scroll', this.handleScrollOrResize, {
      capture: true,
      passive: true,
    });
    this.win.addEventListener('resize', this.handleScrollOrResize);
  }

  public isDragging(): boolean {
    return this.mode !== 'idle';
  }

  public consumeClickSuppression(): boolean {
    if (!this.suppressClick) return false;
    this.suppressClick = false;
    return true;
  }

  public beginCanvasDrag(elements: readonly Element[], x: number, y: number): void {
    const normalized = normalizeDraggableElements(elements);
    if (normalized.length === 0) return;

    this.resetDragState();
    this.mode = 'canvas';
    this.dragged = normalized;
    this.startX = x;
    this.startY = y;
    this.lastX = x;
    this.lastY = y;
    this.exceededThreshold = false;
    this.win.addEventListener('pointermove', this.handlePointerMove, true);
    this.win.addEventListener('pointerup', this.handlePointerUp, true);
    this.win.addEventListener('pointercancel', this.handlePointerCancel, true);
  }

  private handlePointerCancel = (): void => {
    this.cancel();
  };

  public studioDragOver(p: StudioDragOverPayload): void {
    if (this.mode !== 'studio') {
      this.resetDragState();
      this.mode = 'studio';
    }
    this.dragged =
      p.source === 'layer' && p.refs ? resolveElementsByRefs(p.refs, this.win.document) : [];
    this.lastX = p.x;
    this.lastY = p.y;
    this.updateAutoScroll(p.y);
    this.evaluateDropTarget(p.x, p.y);
  }

  public studioDragEnd(drop: boolean): void {
    if (!drop && this.lastTargetKey !== '' && this.lastTargetKey !== '{}') {
      this.cb.sendDropTarget({});
    }
    this.cb.showIndicator(undefined);
    this.resetDragState();
  }

  public cancel(): void {
    if (!this.isDragging()) return;
    this.cb.showIndicator(undefined);
    this.cb.sendDropTarget({});
    this.resetDragState();
  }

  public destroy(): void {
    this.resetDragState();
    this.win.removeEventListener('scroll', this.handleScrollOrResize, true);
    this.win.removeEventListener('resize', this.handleScrollOrResize);
  }

  private handleScrollOrResize = (): void => {
    this.clearCache();
  };

  private clearCache(): void {
    this.cache = {};
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.mode !== 'canvas') return;
    if (!this.exceededThreshold) {
      if (
        Math.hypot(event.clientX - this.startX, event.clientY - this.startY) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      this.exceededThreshold = true;
    }
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.updateAutoScroll(this.lastY);
    this.scheduleMoveUpdate();
  };

  private scheduleMoveUpdate(): void {
    if (this.moveRafId !== undefined) return;
    this.moveRafId = this.win.requestAnimationFrame(() => {
      this.moveRafId = undefined;
      if (this.mode === 'canvas') {
        this.evaluateDropTarget(this.lastX, this.lastY);
      }
    });
  }

  private handlePointerUp = (): void => {
    if (this.mode !== 'canvas') return;
    if (this.moveRafId !== undefined) {
      this.win.cancelAnimationFrame(this.moveRafId);
      this.moveRafId = undefined;
      if (this.exceededThreshold) {
        this.evaluateDropTarget(this.lastX, this.lastY);
      }
    }

    const wasDragging = this.exceededThreshold;
    const target = this.currentTarget;
    const dragged = this.dragged;
    this.resetDragState();

    if (wasDragging) {
      this.suppressClick = true;
      if (target) {
        const elements = dragged.map((el) => ({
          loc: el.getAttribute('data-rc-loc') ?? '',
          tag: el.localName,
        }));
        this.cb.sendMoveIntent({ elements, target });
      }
      this.cb.showIndicator(undefined);
      this.cb.sendDropTarget({});
    }
  };

  private evaluateDropTarget(x: number, y: number): void {
    const res = findDropTarget(x, y, this.dragged, this.env, this.cache);
    this.cb.showIndicator(res);
    this.currentTarget = res?.target;
    const nextKey = res ? JSON.stringify(res.target) : '';
    if (nextKey !== this.lastTargetKey) {
      this.lastTargetKey = nextKey;
      if (res) {
        this.cb.sendDropTarget({ target: res.target, rect: res.rect, label: res.label });
      } else {
        this.cb.sendDropTarget({});
      }
    }
  }

  private updateAutoScroll(y: number): void {
    const h = this.win.innerHeight;
    if (y < AUTO_SCROLL_MARGIN_PX) {
      this.scrollDelta = -AUTO_SCROLL_STEP_PX;
    } else if (h > AUTO_SCROLL_MARGIN_PX * 2 && y > h - AUTO_SCROLL_MARGIN_PX) {
      this.scrollDelta = AUTO_SCROLL_STEP_PX;
    } else {
      this.scrollDelta = 0;
    }

    if (this.scrollDelta === 0) {
      if (this.scrollRafId !== undefined) {
        this.win.cancelAnimationFrame(this.scrollRafId);
        this.scrollRafId = undefined;
      }
      return;
    }

    if (this.scrollRafId === undefined) {
      this.scrollRafId = this.win.requestAnimationFrame(this.stepAutoScroll);
    }
  }

  private stepAutoScroll = (): void => {
    this.scrollRafId = undefined;
    if (!this.isDragging() || this.scrollDelta === 0) return;
    this.win.scrollBy(0, this.scrollDelta);
    this.clearCache();
    this.scrollRafId = this.win.requestAnimationFrame(this.stepAutoScroll);
  };

  private resetDragState(): void {
    if (this.moveRafId !== undefined) {
      this.win.cancelAnimationFrame(this.moveRafId);
      this.moveRafId = undefined;
    }
    if (this.scrollRafId !== undefined) {
      this.win.cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = undefined;
    }
    this.win.removeEventListener('pointermove', this.handlePointerMove, true);
    this.win.removeEventListener('pointerup', this.handlePointerUp, true);
    this.win.removeEventListener('pointercancel', this.handlePointerCancel, true);
    this.mode = 'idle';
    this.dragged = [];
    this.exceededThreshold = false;
    this.currentTarget = undefined;
    this.lastTargetKey = '';
    this.scrollDelta = 0;
    this.clearCache();
  }
}
