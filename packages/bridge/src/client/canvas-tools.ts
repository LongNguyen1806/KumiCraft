// Canvas tools added in Phase 2: free frame move/resize/measure and the right-click layer menu
// (SPEC-04 section 18E R-FF-10..14, R-SL-13). Kept out of the runtime so it stays one screen of wiring.
import type { ElementRef } from '@reactcraft/shared';

import { FreeDragController } from './free-frame/free-drag.ts';
import { type GridSize, measureFreeFrame, viewportMeasure } from './free-frame/free-geometry.ts';
import { buildLayerMenu } from './layer-menu.ts';
import type { BridgeOverlay } from './overlay.ts';

export type SendToStudio = (type: string, payload: unknown) => void;

export class CanvasTools {
  private readonly send: SendToStudio;
  private readonly overlay: BridgeOverlay;
  private readonly freeDrag: FreeDragController;
  private layerMenuOpen = false;

  constructor(send: SendToStudio, overlay: BridgeOverlay, win: Window) {
    this.send = send;
    this.overlay = overlay;
    this.freeDrag = new FreeDragController(
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
      },
      win,
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

  public getGrid(): GridSize {
    return this.freeDrag.getGrid();
  }

  /** `set-grid` from Studio (R-FF-11). */
  public setGrid(size: GridSize): void {
    this.freeDrag.setGrid(size);
    this.overlay.free.setGrid(size);
    this.overlay.requestRender();
  }

  /** `measure-free` from Studio: answers with `free-measure`; an unknown element gets no answer. */
  public measureFree(ref: ElementRef, doc: Document): void {
    const frame = doc.querySelectorAll(`[data-rc-loc="${ref.loc}"]`)[ref.index];
    const payload = frame === undefined ? undefined : measureFreeFrame(frame, doc, viewportMeasure);
    if (payload !== undefined) this.send('free-measure', payload);
  }

  /** A press on the page in design mode. True when it started a free move (R-FF-13). */
  public pointerDown(event: PointerEvent, selected: readonly Element[]): boolean {
    this.closeLayerMenu();
    if (event.button !== 0 || !(event.target instanceof Element)) return false;
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
  }

  /** Studio picked an element (possibly from the menu), so Studio has closed the menu itself. */
  public selectionChanged(): void {
    this.layerMenuOpen = false;
  }

  /** Esc: cancels a free move or resize in progress. True when there was one. */
  public escape(): boolean {
    if (!this.freeDrag.isActive()) return false;
    this.freeDrag.cancel();
    return true;
  }

  public isDragging(): boolean {
    return this.freeDrag.isActive();
  }

  public consumeClickSuppression(): boolean {
    return this.freeDrag.consumeClickSuppression();
  }

  /** Element that shows size handles (R-FF-14), or `undefined` to hide them. */
  public syncHandles(target: Element | undefined): void {
    this.overlay.free.setResizeTarget(target);
    this.overlay.requestRender();
  }

  /** Leaving design mode: drop any move or resize and close the menu. */
  public cancel(): void {
    this.freeDrag.cancel();
    this.closeLayerMenu();
  }

  public destroy(): void {
    this.freeDrag.destroy();
  }

  private closeLayerMenu(): void {
    if (!this.layerMenuOpen) return;
    this.layerMenuOpen = false;
    this.send('layer-menu-close', {});
  }
}
