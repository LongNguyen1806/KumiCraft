// Bridge postMessage communication channel for Studio (SPEC-04 M-BR, R-BR-30, R-BR-31, V-110..111).
import {
  BridgeBuildErrorPayloadSchema,
  BridgeDrawEndPayloadSchema,
  BridgeDropTargetPayloadSchema,
  BridgeEnvelopeSchema,
  type BridgeFreeMeasurePayload,
  BridgeFreeMeasurePayloadSchema,
  type BridgeFreeMovePayload,
  BridgeFreeMovePayloadSchema,
  type BridgeFreeResizePayload,
  BridgeFreeResizePayloadSchema,
  BridgeHoverPayloadSchema,
  BridgeLayerMenuClosePayloadSchema,
  BridgeLayerMenuPayloadSchema,
  BridgeMoveIntentPayloadSchema,
  BridgeReadyPayloadSchema,
  BridgeRoutePayloadSchema,
  BridgeRuntimeErrorPayloadSchema,
  BridgeSelectionInfoPayloadSchema,
  BridgeSelectPayloadSchema,
  BridgeShortcutPayloadSchema,
  type BridgeTextCancelPayload,
  BridgeTextCancelPayloadSchema,
  type BridgeTextCommitPayload,
  BridgeTextCommitPayloadSchema,
  type BridgeTextEditRequestPayload,
  BridgeTextEditRequestPayloadSchema,
  BridgeTreePayloadSchema,
  type DrawTool,
  type ElementRef,
  type KeyPress,
  matchShortcut,
  type StudioDragOverPayload,
} from '@reactcraft/shared';

import { isApplePlatform } from '../../app/platform.ts';
import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { useDndStore } from '../dnd/dnd-store.ts';
import { executeDropMove } from '../dnd/drop-actions.ts';
import { handleDrawEnd } from '../draw/draw-commands.ts';
import { placementTailwindMajor, useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useLayerMenuStore } from '../layer-menu/layer-menu-store.ts';
import { runShortcut } from '../shortcuts/shortcut-actions.ts';
import { type CanvasMode, useSelectionStore } from './selection-store.ts';

function handleBridgeShortcut(payload: unknown): void {
  const res = BridgeShortcutPayloadSchema.safeParse(payload);
  if (!res.success) return;
  const press: KeyPress = {
    key: res.data.key,
    ctrl: res.data.ctrl,
    meta: res.data.meta,
    shift: res.data.shift,
    alt: res.data.alt,
  };
  const apple = isApplePlatform();
  const action = matchShortcut(press, apple);
  if (action) {
    runShortcut(action);
  }
}

function handleErrorBridgePayload(type: string, payload: unknown): boolean {
  if (type === 'build-error') {
    const res = BridgeBuildErrorPayloadSchema.safeParse(payload);
    if (res.success) useCanvasErrorStore.getState().setBuildError(res.data);
    return true;
  }
  if (type === 'build-ok') {
    useCanvasErrorStore.getState().clearBuildError();
    return true;
  }
  if (type === 'runtime-error') {
    const res = BridgeRuntimeErrorPayloadSchema.safeParse(payload);
    if (res.success) useCanvasErrorStore.getState().addRuntimeError(res.data);
    return true;
  }
  return false;
}

function handleDndBridgePayload(type: string, payload: unknown): boolean {
  if (type === 'drop-target') {
    const res = BridgeDropTargetPayloadSchema.safeParse(payload);
    if (res.success) {
      useDndStore.getState().setDropTarget(res.data.target, res.data.placement);
    }
    return true;
  }
  if (type === 'move-intent') {
    const res = BridgeMoveIntentPayloadSchema.safeParse(payload);
    if (res.success) {
      void executeDropMove(
        res.data.elements,
        res.data.target,
        res.data.placement,
        placementTailwindMajor(res.data.placement),
      );
    }
    return true;
  }
  return false;
}

function handleLayerMenuBridgePayload(type: string, payload: unknown): boolean {
  if (type === 'layer-menu') {
    const res = BridgeLayerMenuPayloadSchema.safeParse(payload);
    if (res.success) useLayerMenuStore.getState().show(res.data);
    return true;
  }
  if (type === 'layer-menu-close') {
    const res = BridgeLayerMenuClosePayloadSchema.safeParse(payload);
    if (res.success) useLayerMenuStore.getState().close();
    return true;
  }
  if (type === 'draw-end') {
    const res = BridgeDrawEndPayloadSchema.safeParse(payload);
    if (res.success) {
      useDndStore.getState().setError(undefined);
      void handleDrawEnd(res.data);
    }
    return true;
  }
  return false;
}

function dispatchBridgePayload(type: string, payload: unknown): void {
  if (handleErrorBridgePayload(type, payload)) return;
  if (handleDndBridgePayload(type, payload)) return;
  if (handleLayerMenuBridgePayload(type, payload)) return;
  const state = useSelectionStore.getState();
  switch (type) {
    case 'shortcut': {
      handleBridgeShortcut(payload);
      break;
    }
    case 'ready': {
      const res = BridgeReadyPayloadSchema.safeParse(payload);
      if (res.success) {
        state.setRoute(res.data.route);
        state.setBridgeReady(true);
      }
      useCanvasErrorStore.getState().dismissRuntimeErrors();
      break;
    }
    case 'hover': {
      const res = BridgeHoverPayloadSchema.safeParse(payload);
      if (res.success) state.setHoveredRef(res.data.ref);
      break;
    }
    case 'select': {
      useLayerMenuStore.getState().close();
      const res = BridgeSelectPayloadSchema.safeParse(payload);
      if (res.success) state.setSelectedRefs(res.data.refs);
      break;
    }
    case 'selection-info': {
      const res = BridgeSelectionInfoPayloadSchema.safeParse(payload);
      if (res.success) state.setSelectionInfo(res.data.items);
      break;
    }
    case 'tree': {
      const res = BridgeTreePayloadSchema.safeParse(payload);
      if (res.success) state.setTree(res.data.nodes, res.data.truncated);
      break;
    }
    case 'route': {
      const res = BridgeRoutePayloadSchema.safeParse(payload);
      if (res.success) state.setRoute(res.data.route);
      break;
    }
  }
}

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

export class BridgeChannel {
  private iframeWindow: Window | undefined;
  private runnerOrigin: string | undefined;
  private nonce: string | undefined;
  /** Last file sent with `design-file`, sent again to a Bridge that just started (R-CP-11). */
  private designFile: string | undefined;
  private designFocus = false;
  /**
   * Until the Bridge answers, the iframe may still show the blank page it starts with (the Studio's
   * own origin): posting then fails with an origin mismatch. Messages wait here, the latest one of
   * each type, and go out when the first verified Bridge message arrives (S-101).
   */
  private bridgeAlive = false;
  private readonly waiting = new Map<string, unknown>();
  private readonly listener: (e: MessageEvent) => void;
  private readonly textEditListeners = new Set<BridgeTextEditListener>();
  private readonly freeFrameListeners = new Set<BridgeFreeFrameListener>();

  constructor() {
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

    // Any verified message proves the Bridge runs (R-RN-24), even if `ready` came too early.
    useSelectionStore.getState().setBridgeReady(true);
    this.flushWaiting();
    dispatchBridgePayload(envelopeRes.data.type, envelopeRes.data.payload);
    // A full reload of the page starts a new Bridge that does not know the design file yet.
    if (envelopeRes.data.type === 'ready') {
      const payload = this.designFocus
        ? { file: this.designFile, focus: true }
        : { file: this.designFile };
      this.sendMessage('design-file', payload);
      this.setGrid(useCanvasViewStore.getState().grid);
      this.setTool(useCanvasViewStore.getState().tool);
    }
    this.handleTextEditMessage(envelopeRes.data.type, envelopeRes.data.payload);
    this.handleFreeFrameMessage(envelopeRes.data.type, envelopeRes.data.payload);
  }

  private handleTextEditMessage(type: string, payload: unknown): void {
    if (type === 'text-edit-request') {
      const res = BridgeTextEditRequestPayloadSchema.safeParse(payload);
      if (res.success) {
        for (const l of this.textEditListeners) l.onTextEditRequest?.(res.data);
      }
    } else if (type === 'text-commit') {
      const res = BridgeTextCommitPayloadSchema.safeParse(payload);
      if (res.success) {
        for (const l of this.textEditListeners) l.onTextCommit?.(res.data);
      }
    } else if (type === 'text-cancel') {
      const res = BridgeTextCancelPayloadSchema.safeParse(payload);
      if (res.success) {
        for (const l of this.textEditListeners) l.onTextCancel?.(res.data);
      }
    }
  }

  private handleFreeFrameMessage(type: string, payload: unknown): void {
    if (type === 'free-measure') {
      const res = BridgeFreeMeasurePayloadSchema.safeParse(payload);
      if (res.success) {
        for (const l of this.freeFrameListeners) l.onFreeMeasure?.(res.data);
      }
    } else if (type === 'free-move') {
      const res = BridgeFreeMovePayloadSchema.safeParse(payload);
      if (res.success) {
        for (const l of this.freeFrameListeners) l.onFreeMove?.(res.data);
      }
    } else if (type === 'free-resize') {
      const res = BridgeFreeResizePayloadSchema.safeParse(payload);
      if (res.success) {
        for (const l of this.freeFrameListeners) l.onFreeResize?.(res.data);
      }
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
    const msg = {
      rc: 1,
      nonce: this.nonce,
      type,
      payload,
    };
    this.iframeWindow.postMessage(msg, this.runnerOrigin);
  }
}

export const studioBridgeChannel = new BridgeChannel();

export function useBridgeChannel(): BridgeChannel {
  return studioBridgeChannel;
}
