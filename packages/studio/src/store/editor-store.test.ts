import { createDefaultTokens, type DesignDocument } from '@reactcraft/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http.ts';
import { createEditorStore } from './editor-store.ts';

function createSampleDocument(): DesignDocument {
  return {
    workspace: {
      schemaVersion: 1,
      id: 'w_0123456789',
      name: 'Store Test',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      revision: 1,
      pageOrder: ['p_home000001'],
      backends: [],
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      contentLocale: 'vi-VN',
      darkMode: 'none',
    },
    tokens: createDefaultTokens(),
    pages: {
      p_home000001: {
        schemaVersion: 1,
        id: 'p_home000001',
        name: 'Home',
        route: '/',
        root: {
          id: 'n_root000001',
          type: 'Stack',
          content: { kind: 'none' },
          children: [
            {
              id: 'n_card000001',
              type: 'Card',
              content: { kind: 'none' },
              children: [
                {
                  id: 'n_text000001',
                  type: 'Text',
                  content: { kind: 'text', text: 'Original text' },
                },
              ],
            },
          ],
        },
      },
    },
    components: {},
    dataSources: {
      schemaVersion: 1,
      auth: { kind: 'none' },
      entities: [],
      endpoints: [],
    },
  };
}

describe('Editor Store & History Store', () => {
  let doc: DesignDocument;

  beforeEach(() => {
    doc = createSampleDocument();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loadDocument initializes state and flatNodes', () => {
    const store = createEditorStore();
    store.getState().loadDocument(doc, 1);

    const state = store.getState();
    expect(state.document).toBeDefined();
    expect(state.revision).toBe(1);
    expect(state.activePageId).toBe('p_home000001');
    expect(state.flatNodes['n_root000001']).toBeDefined();
    expect(state.flatNodes['n_card000001']).toBeDefined();
    expect(state.flatNodes['n_text000001']).toBeDefined();
    expect(state.canUndo()).toBe(false);
    expect(state.canRedo()).toBe(false);
  });

  it('selectNode and hoverNode update selection', () => {
    const store = createEditorStore();
    store.getState().loadDocument(doc, 1);

    store.getState().selectNode('n_card000001');
    expect(store.getState().selectedNodeId).toBe('n_card000001');

    store.getState().hoverNode('n_text000001');
    expect(store.getState().hoveredNodeId).toBe('n_text000001');

    store.getState().selectNode(undefined);
    expect(store.getState().selectedNodeId).toBeUndefined();
  });

  it('dispatch applies operations locally, pushes to undo stack, and syncs to server', async () => {
    const sendBatch = vi.fn().mockResolvedValue({ revision: 2, idMap: {} });
    const store = createEditorStore({ sendBatch });
    store.getState().loadDocument(doc, 1);

    const res = store.getState().dispatch(
      [
        {
          op: 'setContent',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'n_text000001',
          set: { text: 'Updated text' },
        },
      ],
      { source: 'user', label: 'Edit Text' },
    );

    expect(res.ok).toBe(true);
    const textNode = store.getState().flatNodes['n_text000001'];
    expect(textNode?.content).toEqual({ kind: 'text', text: 'Updated text' });
    expect(store.getState().canUndo()).toBe(true);
    expect(store.getState().canRedo()).toBe(false);

    await store.getState().flushSync();
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(store.getState().revision).toBe(2);
    expect(store.getState().syncStatus).toBe('saved');
  });

  it('undo and redo restore document state and adjust stacks synchronously', () => {
    const sendBatch = vi.fn().mockResolvedValue({ revision: 2, idMap: {} });
    const store = createEditorStore({ sendBatch });
    store.getState().loadDocument(doc, 1);

    store.getState().dispatch(
      [
        {
          op: 'setContent',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'n_text000001',
          set: { text: 'Step 1' },
        },
      ],
      { source: 'user', label: 'Step 1' },
    );

    expect(store.getState().flatNodes['n_text000001']?.content).toEqual({
      kind: 'text',
      text: 'Step 1',
    });

    store.getState().undo();
    expect(store.getState().flatNodes['n_text000001']?.content).toEqual({
      kind: 'text',
      text: 'Original text',
    });
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(true);

    store.getState().redo();
    expect(store.getState().flatNodes['n_text000001']?.content).toEqual({
      kind: 'text',
      text: 'Step 1',
    });
    expect(store.getState().canUndo()).toBe(true);
    expect(store.getState().canRedo()).toBe(false);
  });

  it('dispatching invalid operation returns error without mutating state or history', () => {
    const store = createEditorStore();
    store.getState().loadDocument(doc, 1);

    // Target a node that does not exist
    const res = store.getState().dispatch(
      [
        {
          op: 'setContent',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'non_existent_node_id',
          set: { text: 'Invalid' },
        },
      ],
      { source: 'user', label: 'Invalid Op' },
    );

    expect(res.ok).toBe(false);
    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().flatNodes['n_text000001']?.content).toEqual({
      kind: 'text',
      text: 'Original text',
    });
  });

  it('undo and redo on empty history are safe no-ops', () => {
    const store = createEditorStore();
    store.getState().loadDocument(doc, 1);

    expect(() => {
      store.getState().undo();
      store.getState().redo();
    }).not.toThrow();

    expect(store.getState().canUndo()).toBe(false);
    expect(store.getState().canRedo()).toBe(false);
  });

  it('dispatching a new action after undo clears the redo stack', () => {
    const store = createEditorStore();
    store.getState().loadDocument(doc, 1);

    store.getState().dispatch(
      [
        {
          op: 'setContent',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'n_text000001',
          set: { text: 'Branch A' },
        },
      ],
      { source: 'user', label: 'A' },
    );

    store.getState().undo();
    expect(store.getState().canRedo()).toBe(true);

    // New operation branch
    store.getState().dispatch(
      [
        {
          op: 'setContent',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'n_text000001',
          set: { text: 'Branch B' },
        },
      ],
      { source: 'user', label: 'B' },
    );

    expect(store.getState().canRedo()).toBe(false);
    expect(store.getState().flatNodes['n_text000001']?.content).toEqual({
      kind: 'text',
      text: 'Branch B',
    });
  });

  it('marks syncStatus as external_conflict on E017 API error', async () => {
    const sendBatch = vi.fn().mockRejectedValue(new ApiError(409, 'E017'));
    const store = createEditorStore({ sendBatch });
    store.getState().loadDocument(doc, 1);

    store.getState().dispatch(
      [
        {
          op: 'setContent',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'n_text000001',
          set: { text: 'Conflicting change' },
        },
      ],
      { source: 'user', label: 'Conflict test' },
    );

    await store.getState().flushSync();
    expect(store.getState().syncStatus).toBe('external_conflict');
  });

  it('marks syncStatus as error on generic network/server failure', async () => {
    const sendBatch = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));
    const store = createEditorStore({ sendBatch });
    store.getState().loadDocument(doc, 1);

    store.getState().dispatch(
      [
        {
          op: 'setContent',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'n_text000001',
          set: { text: 'Server failure change' },
        },
      ],
      { source: 'user', label: 'Error test' },
    );

    await store.getState().flushSync();
    expect(store.getState().syncStatus).toBe('error');
  });

  it('handles loadDocument when page does not exist in document', () => {
    const emptyDoc: DesignDocument = {
      ...doc,
      workspace: { ...doc.workspace, pageOrder: ['p_missing'] },
      pages: {},
    };
    const store = createEditorStore();
    store.getState().loadDocument(emptyDoc, 1);

    expect(store.getState().activePageId).toBe('p_missing');
    expect(store.getState().flatNodes).toEqual({});
  });
});
