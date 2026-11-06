// Base BridgeChannel for postMessage communication (SPEC-04 M-BR, R-BR-30, R-BR-31, V-110..111).
import {
  BridgeEnvelopeSchema,
  type BridgeFreeMeasurePayload,
  BridgeFreeMeasurePayloadSchema,
  type BridgeFreeMovePayload,
  BridgeFreeMovePayloadSchema,
  type BridgeFreeResizePayload,
  BridgeFreeResizePayloadSchema,
  BridgeReadyPayloadSchema,
  BridgeRoutePayloadSchema,
  BridgeSelectPayloadSchema,
  type BridgeStyleProbePayload,
  BridgeStyleProbePayloadSchema,
  type BridgeTextCancelPayload,
  BridgeTextCancelPayloadSchema,
  type BridgeTextCommitPayload,
  BridgeTextCommitPayloadSchema,
  type BridgeTextEditRequestPayload,
  BridgeTextEditRequestPayloadSchema,
  type DrawTool,
  type ElementRef,
  type StudioDragOverPayload,
  type StyleState,
} from '@kumicraft/shared';

import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { useDndStore } from '../dnd/dnd-store.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { dispatchBridgePayload } from './bridge-payload-handlers.ts';
import { handleCanvasNavigation } from './canvas-navigation-messages.ts';
import { type CanvasMode, useSelectionStore } from './selection-store.ts';

export type BridgeTextEditListener = {
  readonly onTextEditRequest?: (payload: BridgeTextEditRequestPayload) => void;
  readonly onTextCommit?: (payload: BridgeTextCommitPayload) => void;
  readonly onTextCancel?: (payload: BridgeTextCancelPayload) => void;
};

export type BridgeFreeFrameListener = {
  readonly onFreeMeasure?: (payload: BridgeFreeMeasurePayload) => void;
  readonly onFreeMove?: (payload: BridgeFreeMovePayload) => void;
  readonly onFreeResize?: (payload: BridgeFreeResizePayload) => void;
};

export type SelectionSyncCallback = (
  sourceOpenFrameId: string,
  refs: readonly ElementRef[],
) => void;

export type BridgeListenerSets = {
  readonly textEdit: Set<BridgeTextEditListener>;
  readonly freeFrame: Set<BridgeFreeFrameListener>;
  readonly styleProbe: Set<(payload: BridgeStyleProbePayload) => void>;
};

export class BridgeChannel {
  protected iframeWindow: Window | undefined;
  protected runnerOrigin: string | undefined;
  protected nonce: string | undefined;
  /** Last file sent with `design-file`, sent again to a Bridge that just started (R-CP-11). */
  protected designFile: string | undefined;
  protected designFocus = false;
  /**
   * Until the Bridge answers, the iframe may still show the blank page it starts with (the Studio's
   * own origin): posting then fails with an origin mismatch. Messages wait here, the latest one of
   * each type, and go out when the first verified Bridge message arrives (S-101).
   */
  protected bridgeAlive = false;
  protected readonly waiting = new Map<string, unknown>();
  protected readonly listener: (e: MessageEvent) => void;
  protected readonly textEditListeners: Set<BridgeTextEditListener>;
  protected readonly freeFrameListeners: Set<BridgeFreeFrameListener>;
  protected readonly styleProbeListeners: Set<(payload: BridgeStyleProbePayload) => void>;
  public readonly openFrameId?: string | undefined;
  public onSelectionSync?: SelectionSyncCallback | undefined;

  /**
   * `listeners` shared by every frame's channel (M-MF): the Studio registers text-edit, free-frame
   * and style-probe listeners once, and they hear the frame being worked on, whichever it is.
   */
  constructor(openFrameId?: string, listeners?: BridgeListenerSets) {
    this.openFrameId = openFrameId;
    this.textEditListeners = listeners?.textEdit ?? new Set();
    this.freeFrameListeners = listeners?.freeFrame ?? new Set();
    this.styleProbeListeners = listeners?.styleProbe ?? new Set();
    this.listener = (e: MessageEvent) => {
      this.handleMessage(e);
    };
  }

  attach(iframeWindow: Window, runnerOrigin: string, nonce: string): void {
    this.iframeWindow = iframeWindow;
    this.runnerOrigin = runnerOrigin;
    this.nonce = nonce;
    this.bridgeAlive = false;
    this.waiting.clear();
    window.addEventListener('message', this.listener);
  }

  detach(): void {
    window.removeEventListener('message', this.listener);
    this.iframeWindow = undefined;
    this.runnerOrigin = undefined;
    this.nonce = undefined;
    this.bridgeAlive = false;
    this.waiting.clear();
    useCanvasErrorStore.getState().reset();
    useDndStore.getState().endDrag();
    useSelectionStore.getState().setBridgeReady(false);
  }

  registerTextEditListener(listener: BridgeTextEditListener): () => void {
    this.textEditListeners.add(listener);
    return () => {
      this.textEditListeners.delete(listener);
    };
  }

  registerFreeFrameListener(listener: BridgeFreeFrameListener): () => void {
    this.freeFrameListeners.add(listener);
    return () => {
      this.freeFrameListeners.delete(listener);
    };
  }

  /** `style-probe-result` answers of the Bridge (R-ST-04). */
  registerStyleProbeListener(listener: (payload: BridgeStyleProbePayload) => void): () => void {
    this.styleProbeListeners.add(listener);
    return () => {
      this.styleProbeListeners.delete(listener);
    };
  }

  styleProbe(ref: ElementRef, properties: readonly string[], state?: StyleState): void {
    this.sendMessage('style-probe', { ref, properties, ...(state === undefined ? {} : { state }) });
  }

  sendStylePreview(ref: ElementRef, property: string, value: string): void {
    this.sendMessage('style-preview', { ref, property, value });
  }

  clearStylePreview(): void {
    this.sendMessage('style-preview-clear', {});
  }

  setGrid(size: 1 | 4 | 8 | 16): void {
    this.sendMessage('set-grid', { size });
  }

  setTool(tool: DrawTool): void {
    this.sendMessage('set-tool', { tool });
  }

  measureFree(ref: ElementRef): void {
    this.sendMessage('measure-free', { ref });
  }

  setMode(mode: CanvasMode): void {
    this.sendMessage('set-mode', { mode });
  }

  select(refs: readonly ElementRef[], reveal: boolean): void {
    this.sendMessage('select', { refs, reveal });
  }

  /** Shows another page of the project in the Canvas (R-PG-15, R-BR-19). */
  navigate(route: string): void {
    this.sendMessage('navigate', { route });
  }

  highlight(ref: ElementRef | undefined): void {
    this.sendMessage('highlight', ref === undefined ? {} : { ref });
  }

  startTextEdit(ref: ElementRef): void {
    this.sendMessage('text-edit-start', { ref });
  }

  endTextEdit(ref: ElementRef): void {
    this.sendMessage('text-edit-end', { ref });
  }

  dragOver(payload: StudioDragOverPayload): void {
    this.sendMessage('drag-over', payload);
  }

  dragEnd(drop: boolean): void {
    this.sendMessage('drag-end', { drop });
  }

  setDesignFile(file?: string, focus?: boolean): void {
    this.designFile = file;
    this.designFocus = focus ?? false;
    const payload = focus !== undefined ? { file, focus } : { file };
    this.sendMessage('design-file', payload);
  }

  private handleMessage(event: MessageEvent): void {
    // V-111: verify event.source, event.origin, nonce, and envelope schema
    if (this.iframeWindow === undefined || event.source !== this.iframeWindow) return;
    if (this.runnerOrigin === undefined || event.origin !== this.runnerOrigin) return;

    const envelopeRes = BridgeEnvelopeSchema.safeParse(event.data);
    if (!envelopeRes.success) return;
    if (this.nonce === undefined || envelopeRes.data.nonce !== this.nonce) return;

    this.flushWaiting();
    // Canvas navigation comes from whichever frame the pointer is over, working one or not.
    if (
      handleCanvasNavigation(envelopeRes.data.type, envelopeRes.data.payload, this.iframeWindow)
    ) {
      return;
    }
    const activeId = useCanvasViewStore.getState().activeOpenFrameId;
    const isActive = this.openFrameId === undefined || this.openFrameId === activeId;

    if (!isActive) {
      this.handleNonActiveFrameMessage(envelopeRes.data.type, envelopeRes.data.payload);
      return;
    }

    useSelectionStore.getState().setBridgeReady(true);
    dispatchBridgePayload(envelopeRes.data.type, envelopeRes.data.payload);
    this.handleActiveFrameFollowup(envelopeRes.data.type, envelopeRes.data.payload);
  }

  private handleNonActiveFrameMessage(type: string, payload: unknown): void {
    if (type === 'select') {
      if (this.openFrameId) {
        useCanvasViewStore.getState().setActiveOpenFrameId(this.openFrameId);
        const thisFrame = useCanvasViewStore
          .getState()
          .openFrames.find((f) => f.id === this.openFrameId);
        if (thisFrame) useSelectionStore.getState().setRoute(thisFrame.route);
      }
      dispatchBridgePayload(type, payload);
      const res = BridgeSelectPayloadSchema.safeParse(payload);
      if (res.success && this.openFrameId) {
        this.onSelectionSync?.(this.openFrameId, res.data.refs);
      }
    } else if (type === 'route' || type === 'ready') {
      const res =
        type === 'route'
          ? BridgeRoutePayloadSchema.safeParse(payload)
          : BridgeReadyPayloadSchema.safeParse(payload);
      if (res.success && this.openFrameId) {
        useCanvasViewStore.getState().updateOpenFrame(this.openFrameId, { route: res.data.route });
      }
    }
    this.handleTextEditMessage(type, payload);
    this.handleFreeFrameMessage(type, payload);
  }

  private handleActiveFrameFollowup(type: string, payload: unknown): void {
    if (type === 'route') {
      const res = BridgeRoutePayloadSchema.safeParse(payload);
      if (res.success && this.openFrameId) {
        useCanvasViewStore.getState().updateOpenFrame(this.openFrameId, { route: res.data.route });
      }
    } else if (type === 'select') {
      const res = BridgeSelectPayloadSchema.safeParse(payload);
      if (res.success && this.openFrameId) {
        this.onSelectionSync?.(this.openFrameId, res.data.refs);
      }
    } else if (type === 'ready') {
      const readyRes = BridgeReadyPayloadSchema.safeParse(payload);
      if (readyRes.success && this.openFrameId) {
        useCanvasViewStore
          .getState()
          .updateOpenFrame(this.openFrameId, { route: readyRes.data.route });
      }
      const designPayload = this.designFocus
        ? { file: this.designFile, focus: true }
        : { file: this.designFile };
      this.sendMessage('design-file', designPayload);
      this.setGrid(useCanvasViewStore.getState().grid);
      this.setTool(useCanvasViewStore.getState().tool);
    }
    this.handleTextEditMessage(type, payload);
    this.handleFreeFrameMessage(type, payload);
    if (type === 'style-probe-result') {
      const res = BridgeStyleProbePayloadSchema.safeParse(payload);
      if (res.success) for (const l of this.styleProbeListeners) l(res.data);
    }
  }

  private handleTextEditMessage(type: string, payload: unknown): void {
    if (type === 'text-edit-request') {
      const res = BridgeTextEditRequestPayloadSchema.safeParse(payload);
      if (res.success) for (const l of this.textEditListeners) l.onTextEditRequest?.(res.data);
    } else if (type === 'text-commit') {
      const res = BridgeTextCommitPayloadSchema.safeParse(payload);
      if (res.success) for (const l of this.textEditListeners) l.onTextCommit?.(res.data);
    } else if (type === 'text-cancel') {
      const res = BridgeTextCancelPayloadSchema.safeParse(payload);
      if (res.success) for (const l of this.textEditListeners) l.onTextCancel?.(res.data);
    }
  }

  private handleFreeFrameMessage(type: string, payload: unknown): void {
    if (type === 'free-measure') {
      const res = BridgeFreeMeasurePayloadSchema.safeParse(payload);
      if (res.success) for (const l of this.freeFrameListeners) l.onFreeMeasure?.(res.data);
    } else if (type === 'free-move') {
      const res = BridgeFreeMovePayloadSchema.safeParse(payload);
      if (res.success) for (const l of this.freeFrameListeners) l.onFreeMove?.(res.data);
    } else if (type === 'free-resize') {
      const res = BridgeFreeResizePayloadSchema.safeParse(payload);
      if (res.success) for (const l of this.freeFrameListeners) l.onFreeResize?.(res.data);
    }
  }

  private flushWaiting(): void {
    if (this.bridgeAlive) return;
    this.bridgeAlive = true;
    const waiting = [...this.waiting];
    this.waiting.clear();
    for (const [type, payload] of waiting) this.sendMessage(type, payload);
  }

  private sendMessage(type: string, payload: unknown): void {
    if (
      this.iframeWindow === undefined ||
      this.runnerOrigin === undefined ||
      this.nonce === undefined
    ) {
      return;
    }
    if (!this.bridgeAlive) {
      // Re-insert so the order follows the latest call of each type.
      this.waiting.delete(type);
      this.waiting.set(type, payload);
      return;
    }
    if (typeof this.iframeWindow.postMessage === 'function') {
      this.iframeWindow.postMessage({ rc: 1, nonce: this.nonce, type, payload }, this.runnerOrigin);
    }
  }
}
