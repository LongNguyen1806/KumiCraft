// Bridge postMessage communication channel for Studio (SPEC-04 M-BR, R-BR-30, R-BR-31, V-110..111).
import {
  BridgeBuildErrorPayloadSchema,
  BridgeEnvelopeSchema,
  BridgeHoverPayloadSchema,
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
  type ElementRef,
} from '@reactcraft/shared';

import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { shortcutFor } from '../editor/use-editor-shortcuts.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { type CanvasMode, useSelectionStore } from './selection-store.ts';

function handleBridgeShortcut(payload: unknown): void {
  const res = BridgeShortcutPayloadSchema.safeParse(payload);
  if (!res.success) return;
  const action = shortcutFor({
    key: res.data.key,
    ctrlKey: res.data.ctrl,
    metaKey: res.data.meta,
    shiftKey: res.data.shift,
    altKey: res.data.alt,
  });
  if (action === 'undo') {
    void useHistoryStore.getState().undo();
  } else if (action === 'redo') {
    void useHistoryStore.getState().redo();
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

function dispatchBridgePayload(type: string, payload: unknown): void {
  if (handleErrorBridgePayload(type, payload)) return;
  const state = useSelectionStore.getState();
  switch (type) {
    case 'shortcut': {
      handleBridgeShortcut(payload);
      break;
    }
    case 'ready': {
      const res = BridgeReadyPayloadSchema.safeParse(payload);
      if (res.success) state.setRoute(res.data.route);
      useCanvasErrorStore.getState().dismissRuntimeErrors();
      break;
    }
    case 'hover': {
      const res = BridgeHoverPayloadSchema.safeParse(payload);
      if (res.success) state.setHoveredRef(res.data.ref);
      break;
    }
    case 'select': {
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

export class BridgeChannel {
  private iframeWindow: Window | undefined;
  private runnerOrigin: string | undefined;
  private nonce: string | undefined;
  private readonly listener: (e: MessageEvent) => void;
  private readonly textEditListeners = new Set<BridgeTextEditListener>();

  constructor() {
    this.listener = (e: MessageEvent) => {
      this.handleMessage(e);
    };
  }

  attach(iframeWindow: Window, runnerOrigin: string, nonce: string): void {
    this.iframeWindow = iframeWindow;
    this.runnerOrigin = runnerOrigin;
    this.nonce = nonce;
    window.addEventListener('message', this.listener);
  }

  detach(): void {
    window.removeEventListener('message', this.listener);
    this.iframeWindow = undefined;
    this.runnerOrigin = undefined;
    this.nonce = undefined;
    useCanvasErrorStore.getState().reset();
  }

  registerTextEditListener(listener: BridgeTextEditListener): () => void {
    this.textEditListeners.add(listener);
    return () => {
      this.textEditListeners.delete(listener);
    };
  }

  setMode(mode: CanvasMode): void {
    this.sendMessage('set-mode', { mode });
  }

  select(refs: readonly ElementRef[], reveal: boolean): void {
    this.sendMessage('select', { refs, reveal });
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

  private handleMessage(event: MessageEvent): void {
    // V-111: verify event.source, event.origin, nonce, and envelope schema
    if (this.iframeWindow === undefined || event.source !== this.iframeWindow) return;
    if (this.runnerOrigin === undefined || event.origin !== this.runnerOrigin) return;

    const envelopeRes = BridgeEnvelopeSchema.safeParse(event.data);
    if (!envelopeRes.success) return;
    if (this.nonce === undefined || envelopeRes.data.nonce !== this.nonce) return;

    dispatchBridgePayload(envelopeRes.data.type, envelopeRes.data.payload);
    this.handleTextEditMessage(envelopeRes.data.type, envelopeRes.data.payload);
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

  private sendMessage(type: string, payload: unknown): void {
    if (
      this.iframeWindow === undefined ||
      this.runnerOrigin === undefined ||
      this.nonce === undefined
    ) {
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
