// Unit tests for BridgeChannel (SPEC-03 V-110..111, SPEC-04 R-BR-30, R-BR-31).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHistoryStore } from '../history/history-store.ts';
import { BridgeChannel } from './bridge-channel.ts';
import { useSelectionStore } from './selection-store.ts';

const runnerOrigin = 'http://127.0.0.1:5173';
const currentNonce = 'nonce-abc1234567890123';

describe('BridgeChannel', () => {
  let channel: BridgeChannel;
  let fakeIframeWindow: { postMessage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    useSelectionStore.getState().reset();
    fakeIframeWindow = {
      postMessage: vi.fn(),
    };
    channel = new BridgeChannel();
    channel.attach(fakeIframeWindow as unknown as Window, runnerOrigin, currentNonce);
  });

  afterEach(() => {
    channel.detach();
  });

  it('sends messages with correct envelope and target origin [V-110]', () => {
    channel.setMode('preview');
    expect(fakeIframeWindow.postMessage).toHaveBeenCalledWith(
      {
        rc: 1,
        nonce: currentNonce,
        type: 'set-mode',
        payload: { mode: 'preview' },
      },
      runnerOrigin,
    );
  });

  it('ignores messages with wrong source, origin, or nonce [V-111]', () => {
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
        source: fakeIframeWindow as unknown as Window,
      }),
    );
    expect(useSelectionStore.getState().hoveredRef).toBeUndefined();

    // Wrong nonce
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { ...validPayload, nonce: 'wrong-nonce' },
        origin: runnerOrigin,
        source: fakeIframeWindow as unknown as Window,
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
        source: fakeIframeWindow as unknown as Window,
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
        source: fakeIframeWindow as unknown as Window,
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
        source: fakeIframeWindow as unknown as Window,
      }),
    );

    expect(undoSpy).toHaveBeenCalled();
  });
});
