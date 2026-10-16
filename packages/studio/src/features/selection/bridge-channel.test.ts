// Unit tests for BridgeChannel (SPEC-03 V-110..111, SPEC-04 R-BR-30, R-BR-31).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { BridgeChannel } from './bridge-channel.ts';
import { useSelectionStore } from './selection-store.ts';

const runnerOrigin = 'http://127.0.0.1:5173';
const currentNonce = 'nonce-abc1234567890123';

describe('BridgeChannel', () => {
  let channel: BridgeChannel;
  let iframe: HTMLIFrameElement;
  let fakeIframeWindow: Window;
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useCanvasErrorStore.getState().reset();
    iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    if (!iframe.contentWindow) {
      throw new Error('Missing iframe contentWindow');
    }
    fakeIframeWindow = iframe.contentWindow;
    postMessageSpy = vi.spyOn(fakeIframeWindow, 'postMessage').mockImplementation(() => {});
    channel = new BridgeChannel();
    channel.attach(fakeIframeWindow, runnerOrigin, currentNonce);
  });

  afterEach(() => {
    channel.detach();
    iframe.remove();
  });

  it('sends messages with correct envelope and target origin [V-110, S-101]', () => {
    channel.setMode('preview');
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        rc: 1,
        nonce: currentNonce,
        type: 'set-mode',
        payload: { mode: 'preview' },
      },
      runnerOrigin,
    );
  });

  it('ignores messages with wrong source, origin, or nonce [V-111, R-BR-30]', () => {
    const validPayload = {
      rc: 1,
      nonce: currentNonce,
      type: 'hover',
      payload: { ref: { loc: 'src/App.tsx:1:1', index: 0 } },
    };

    // Wrong source
    window.dispatchEvent(
      new MessageEvent('message', {
        data: validPayload,
        origin: runnerOrigin,
        source: window,
      }),
    );
    expect(useSelectionStore.getState().hoveredRef).toBeUndefined();

    // Wrong origin
    window.dispatchEvent(
      new MessageEvent('message', {
        data: validPayload,
        origin: 'http://malicious-site.com',
        source: fakeIframeWindow,
      }),
    );
    expect(useSelectionStore.getState().hoveredRef).toBeUndefined();

    // Wrong nonce
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...validPayload, nonce: 'wrong-nonce' },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );
    expect(useSelectionStore.getState().hoveredRef).toBeUndefined();
  });

  it('updates store on valid bridge messages [R-BR-31]', () => {
    // tree message
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          rc: 1,
          nonce: currentNonce,
          type: 'tree',
          payload: {
            nodes: [
              {
                ref: { loc: 'src/App.tsx:1:1', index: 0 },
                tag: 'div',
                instances: 1,
              },
            ],
            truncated: false,
          },
        },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );
    expect(useSelectionStore.getState().treeNodes).toHaveLength(1);
    expect(useSelectionStore.getState().treeNodes[0]?.tag).toBe('div');

    // select message
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          rc: 1,
          nonce: currentNonce,
          type: 'select',
          payload: {
            refs: [{ loc: 'src/App.tsx:5:10', index: 0 }],
          },
        },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );
    expect(useSelectionStore.getState().selectedRefs).toHaveLength(1);
  });

  it('dispatches shortcut messages from bridge to history store [R-HI-09]', () => {
    useHistoryStore.getState().applyState({
      undoCount: 1,
      redoCount: 0,
      undo: { key: 'history:setClassName' },
    });
    const undoSpy = vi.spyOn(useHistoryStore.getState(), 'undo');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          rc: 1,
          nonce: currentNonce,
          type: 'shortcut',
          payload: {
            key: 'z',
            ctrl: true,
            meta: false,
            shift: false,
            alt: false,
          },
        },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );

    expect(undoSpy).toHaveBeenCalled();
  });

  it('updates canvas error store on valid build-error message [R-RN-25]', () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          rc: 1,
          nonce: currentNonce,
          type: 'build-error',
          payload: {
            message: 'Syntax error: Unexpected token',
            file: 'src/pages/Home.tsx',
            line: 42,
            column: 3,
          },
        },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );

    const buildError = useCanvasErrorStore.getState().buildError;
    expect(buildError).toEqual({
      message: 'Syntax error: Unexpected token',
      file: 'src/pages/Home.tsx',
      line: 42,
      column: 3,
    });
  });

  it('clears build error on subsequent build-ok message [R-RN-25]', () => {
    useCanvasErrorStore.getState().setBuildError({ message: 'Build error' });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          rc: 1,
          nonce: currentNonce,
          type: 'build-ok',
          payload: {},
        },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );

    expect(useCanvasErrorStore.getState().buildError).toBeUndefined();
  });

  it('ignores runtime-error with message exceeding 2000 chars [R-RN-25]', () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          rc: 1,
          nonce: currentNonce,
          type: 'runtime-error',
          payload: {
            message: 'Valid runtime error',
          },
        },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );

    const store = useCanvasErrorStore.getState();
    expect(store.runtimeErrors).toHaveLength(1);
    expect(store.runtimeErrors[0]?.message).toBe('Valid runtime error');

    const invalidLongMessage = 'a'.repeat(2001);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          rc: 1,
          nonce: currentNonce,
          type: 'runtime-error',
          payload: {
            message: invalidLongMessage,
          },
        },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );

    expect(store.runtimeErrors).toHaveLength(1);
    expect(store.runtimeErrors[0]?.message).toBe('Valid runtime error');
  });

  it('resets canvas error store on detach [R-RN-25]', () => {
    useCanvasErrorStore.getState().setBuildError({ message: 'Old build error' });
    useCanvasErrorStore.getState().addRuntimeError({ message: 'Old runtime error' });

    channel.detach();

    expect(useCanvasErrorStore.getState().buildError).toBeUndefined();
    expect(useCanvasErrorStore.getState().runtimeErrors).toHaveLength(0);
  });

  it('counts any verified Bridge message as connected, even when ready came early [R-RN-24]', () => {
    expect(useSelectionStore.getState().bridgeReady).toBe(false);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { rc: 1, nonce: currentNonce, type: 'tree', payload: { nodes: [] } },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );

    expect(useSelectionStore.getState().bridgeReady).toBe(true);
  });

  it('ignores an unverified message for the connection state [R-RN-24, V-111]', () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { rc: 1, nonce: 'other-nonce', type: 'tree', payload: { nodes: [] } },
        origin: runnerOrigin,
        source: fakeIframeWindow,
      }),
    );

    expect(useSelectionStore.getState().bridgeReady).toBe(false);
  });
});
