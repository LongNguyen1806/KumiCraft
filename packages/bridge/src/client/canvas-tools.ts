// Canvas tools added in Phase 2: free frame move/resize/measure and the right-click layer menu
// (SPEC-04 section 18E R-FF-10..14, R-SL-13). Kept out of the runtime so it stays one screen of wiring.
import type { DrawTool, ElementRef } from '@kumicraft/shared';

import { DrawController } from './draw-tool.ts';
import { FreeDragController } from './free-frame/free-drag.ts';
import { type GridSize, measureFreeFrame, viewportMeasure } from './free-frame/free-geometry.ts';
import { buildLayerMenu } from './layer-menu.ts';
import type { BridgeOverlay } from './overlay.ts';

export type SendToStudio = (type: string, payload: unknown) => void;

function createFreeDrag(
  send: SendToStudio,
  overlay: BridgeOverlay,
  win: Window,
): FreeDragController {
  return new FreeDragController(
    {
      sendMove: (p) => {
        send('free-move', p);
      },
      sendResize: (p) => {
        send('free-resize', p);
      },
      showLabel: (text, anchor) => {
        overlay.free.setLabel(text, anchor);
        overlay.requestRender();
      },
      showGuides: (lines, gaps, frame) => {
        // Frame coordinates start at the padding box and move with the frame's own scroll.
        const rect = frame?.getBoundingClientRect();
        const origin =
          frame !== undefined && rect !== undefined
            ? {
                x: rect.left + frame.clientLeft - frame.scrollLeft,
                y: rect.top + frame.clientTop - frame.scrollTop,
              }
            : undefined;
        overlay.free.setGuides(lines, gaps, origin);
        overlay.requestRender();
      },
    },
    win,
  );
}

export class CanvasTools {
  private readonly send: SendToStudio;
  private readonly overlay: BridgeOverlay;
  private readonly freeDrag: FreeDragController;
  private readonly draw: DrawController;
  private layerMenuOpen = false;

  constructor(
    send: SendToStudio,
    overlay: BridgeOverlay,
    win: Window,
    getDesignFile: () => string | undefined = () => undefined,
  ) {
    this.send = send;
    this.overlay = overlay;
    this.freeDrag = createFreeDrag(send, overlay, win);
    this.draw = new DrawController(
      {
        sendDrawEnd: (p) => {
          send('draw-end', p);
        },
        showDrawRect: (rect) => {
          overlay.setDrawRect(rect);
        },
      },
      win,
      viewportMeasure,
      () => this.freeDrag.getGrid(),
      getDesignFile,
    );
    overlay.free.setCallbacks({
      onResizeDown: (el, dir, x, y) => {
        this.closeLayerMenu();
        this.freeDrag.beginResize(el, dir, x, y);
      },
      onResizeReset: (el) => {
        this.freeDrag.resetSize(el);
      },
    });
  }

  public setTool(tool: DrawTool): void {
    this.draw.setTool(tool);
  }

  public isDrawToolActive(): boolean {
    return this.draw.isActive();
  }

  /**
   * A click while a draw tool is active never selects. It is also the click that follows the
   * release of a draw, so it uses up the draw's click suppression here: left set, it would swallow
   * the user's next real click once the tool is back to Select.
   */
  public swallowDrawClick(): boolean {
    if (!this.draw.isActive()) return false;
    this.draw.consumeClickSuppression();
    return true;
  }

  public getGrid(): GridSize {
    return this.freeDrag.getGrid();
  }

  /** `set-grid` from Studio (R-FF-11). */
  public setGrid(size: GridSize): void {
    this.freeDrag.setGrid(size);
    this.overlay.free.setGrid(size);
    this.overlay.requestRender();
  }

  /** The snap switch and Canvas zoom from `set-grid` (spec-log #125). */
  public setSnap(on: boolean, scale: number): void {
    this.freeDrag.setSnap(on, scale);
    this.overlay.free.setScale(scale);
  }

  /** `measure-free` from Studio: answers with `free-measure`; an unknown element gets no answer. */
  public measureFree(ref: ElementRef, doc: Document): void {
    const frame = doc.querySelectorAll(`[data-rc-loc="${ref.loc}"]`)[ref.index];
    const payload = frame === undefined ? undefined : measureFreeFrame(frame, doc, viewportMeasure);
    if (payload !== undefined) this.send('free-measure', payload);
  }

  /** A press on the page in design mode. True when it started a draw or free move (R-FF-13, R-DT-10). */
  public pointerDown(event: PointerEvent, selected: readonly Element[]): boolean {
    this.closeLayerMenu();
    if (event.button !== 0 || !(event.target instanceof Element)) return false;
    if (this.draw.isActive()) {
      return this.draw.begin(event.clientX, event.clientY, event.view?.document ?? document);
    }
    return this.freeDrag.tryBeginMove(event.target, event.clientX, event.clientY, selected);
  }

  /** Right-click in design mode opens "Chọn lớp" in Studio (R-SL-13). */
  public contextMenu(event: MouseEvent, designFile: string | undefined, focus: boolean): void {
    const menu = buildLayerMenu(
      event.view?.document ?? document,
      event.clientX,
      event.clientY,
      designFile,
      focus,
    );
    if (menu === undefined) return;
    this.send('layer-menu', menu);
    this.layerMenuOpen = true;
  }

  public scrolled(): void {
    this.closeLayerMenu();
    this.overlay.free.setGuides([], []);
    this.overlay.requestRender();
  }

  /** Studio picked an element (possibly from the menu), so Studio has closed the menu itself. */
  public selectionChanged(): void {
    this.layerMenuOpen = false;
  }

  /** Esc: cancels a draw, free move, or resize in progress. True when there was one. */
  public escape(): boolean {
    if (this.draw.escape()) return true;
    if (!this.freeDrag.isActive()) return false;
    this.freeDrag.cancel();
    return true;
  }

  public isDragging(): boolean {
    return this.draw.isDragging() || this.freeDrag.isActive();
  }

  public consumeClickSuppression(): boolean {
    return this.draw.consumeClickSuppression() || this.freeDrag.consumeClickSuppression();
  }

  /** Element that shows size handles (R-FF-14), or `undefined` to hide them. */
  public syncHandles(target: Element | undefined): void {
    this.overlay.free.setResizeTarget(target);
    this.overlay.requestRender();
  }

  /** Leaving design mode: drop any draw, move or resize and close the menu. */
  public cancel(): void {
    this.draw.setTool('select');
    this.freeDrag.cancel();
    this.closeLayerMenu();
  }

  public destroy(): void {
    this.draw.destroy();
    this.freeDrag.destroy();
  }

  private closeLayerMenu(): void {
    if (!this.layerMenuOpen) return;
    this.layerMenuOpen = false;
    this.send('layer-menu-close', {});
  }
}
