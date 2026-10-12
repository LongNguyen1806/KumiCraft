import type { DesignDocument, OperationBatch } from '@reactcraft/model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http.ts';
import type { ApplyOperationsResponse } from '../api/workspace-client.ts';
import { createEditorStore, type StoreDeps } from './editor-store.ts';
import type { HistoryStorage } from './history-persistence.ts';
import { memoryStorage, sampleDocument, setText } from './test-support.ts';

const textOf = (doc: DesignDocument | undefined) => {
  const card = doc?.pages['p_home000001']?.root.children?.[0];
  const content = card?.children?.[0]?.content;
  return content?.kind === 'text' ? content.text : undefined;
};

/** A server that answers every batch with the next revision. */
function server(start = 1) {
  let revision = start;
  return vi.fn<(batch: OperationBatch) => Promise<ApplyOperationsResponse>>(() => {
    revision += 1;
    return Promise.resolve({ revision, idMap: {} });
  });
}

const make = (deps: StoreDeps = {}, storage: HistoryStorage = memoryStorage()) => {
  const store = createEditorStore({ sendBatch: server(), storage, ...deps });
  store.getState().loadDocument(sampleDocument(), 1);
  return store;
};

const edit = (store: ReturnType<typeof make>, text: string) =>
  store.getState().dispatch([setText(text)], { source: 'user', label: 'Edit text' });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('editor store', () => {
  it('loads a document with its first page, nothing to undo', () => {
    const state = make().getState();

    expect(state.activePageId).toBe('p_home000001');
    expect(state.flatNodes['n_text000001']).toBeDefined();
    expect([state.canUndo(), state.canRedo()]).toEqual([false, false]);
  });

  it('selects, hovers and switches pages', () => {
    const store = make();
    store.getState().selectNode('n_card000001');
    store.getState().hoverNode('n_text000001');
    expect(store.getState()).toMatchObject({
      selectedNodeId: 'n_card000001',
      hoveredNodeId: 'n_text000001',
    });

    store.getState().setActivePageId('p_about00001');
    expect(store.getState()).toMatchObject({
      activePageId: 'p_about00001',
      selectedNodeId: undefined,
    });
    expect(Object.keys(store.getState().flatNodes)).toEqual(['n_root000002']);
  });

  it('applies an edit at once and sends it to the server', async () => {
    const sendBatch = server();
    const store = make({ sendBatch });

    expect(edit(store, 'New').ok).toBe(true);
    expect(textOf(store.getState().document)).toBe('New');
    await store.getState().flushSync();

    expect(sendBatch).toHaveBeenCalledWith({
      baseRevision: 1,
      ops: [setText('New')],
      meta: { source: 'user', label: 'Edit text' },
    });
    expect(store.getState()).toMatchObject({ revision: 2, syncStatus: 'saved' });
  });

  it('refuses an invalid edit without touching the document or the history', () => {
    const store = make();
    const before = store.getState().document;

    const result = store.getState().dispatch(
      [
        {
          op: 'remove',
          target: { kind: 'page', pageId: 'p_home000001' },
          nodeId: 'n_missing001',
        },
      ],
      { source: 'user', label: 'Remove' },
    );

    expect(result.ok).toBe(false);
    expect(store.getState().document).toBe(before);
    expect(store.getState().canUndo()).toBe(false);
  });

  it('undoes and redoes, sending each step as its own labelled batch [R-HS-02]', async () => {
    const sendBatch = server();
    const store = make({ sendBatch });
    edit(store, 'New');
    await store.getState().flushSync();

    store.getState().undo();
    expect(textOf(store.getState().document)).toBe('Original text');
    expect([store.getState().canUndo(), store.getState().canRedo()]).toEqual([false, true]);
    await store.getState().flushSync();
    store.getState().redo();
    expect(textOf(store.getState().document)).toBe('New');
    await store.getState().flushSync();

    expect(sendBatch.mock.calls.map(([batch]) => [batch.baseRevision, batch.meta.label])).toEqual([
      [1, 'Edit text'],
      [2, 'Undo: Edit text'],
      [3, 'Redo: Edit text'],
    ]);
  });

  it('clears Redo when a new edit is made, and ignores undo with no history', () => {
    const store = make();
    store.getState().undo();
    edit(store, 'A');
    store.getState().undo();
    edit(store, 'B');

    expect(store.getState().canRedo()).toBe(false);
  });

  it('merges quick edits of the same text into one undo step', () => {
    let now = 1000;
    const store = make({ now: () => now });
    edit(store, 'A');
    now += 300;
    edit(store, 'AB');
    now += 600;
    edit(store, 'ABC');

    expect(store.getState().undoStack).toHaveLength(2);
    store.getState().undo();
    store.getState().undo();
    expect(textOf(store.getState().document)).toBe('Original text');
  });
});

describe('editor store synchronisation', () => {
  it('sends one request at a time, the next one based on the revision just given [R-HS-01] [R-HS-04]', async () => {
    let release: (value: ApplyOperationsResponse) => void = () => undefined;
    let calls = 0;
    const sendBatch = vi.fn<(batch: OperationBatch) => Promise<ApplyOperationsResponse>>(() => {
      calls += 1;
      return calls === 1
        ? new Promise<ApplyOperationsResponse>((resolve) => {
            release = resolve;
          })
        : Promise.resolve({ revision: 3, idMap: {} });
    });
    const store = make({ sendBatch });

    edit(store, 'A');
    const first = store.getState().flushSync();
    edit(store, 'B');
    const second = store.getState().flushSync();
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(store.getState().hasUnsavedChanges()).toBe(true);
    release({ revision: 2, idMap: {} });
    await Promise.all([first, second]);

    expect(sendBatch.mock.calls.map(([batch]) => batch.baseRevision)).toEqual([1, 2]);
    expect(store.getState()).toMatchObject({ revision: 3, syncStatus: 'saved' });
    expect(store.getState().hasUnsavedChanges()).toBe(false);
  });

  it('reloads the document and clears the history on E017', async () => {
    const latest = sampleDocument(9);
    const store = make({
      sendBatch: () => Promise.reject(new ApiError(409, 'E017')),
      fetchDocument: () => Promise.resolve({ document: latest, revision: 9 }),
    });
    edit(store, 'Mine');

    await store.getState().flushSync();
    await vi.waitFor(() => {
      expect(store.getState().notice).toBe('E017');
    });

    expect(store.getState()).toMatchObject({ revision: 9, syncStatus: 'saved', undoStack: [] });
    expect(textOf(store.getState().document)).toBe('Original text');
  });

  it('keeps edits after a network failure and sends them again', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const sendBatch = vi.fn(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new TypeError('offline'))
        : Promise.resolve({ revision: 2, idMap: {} });
    });
    const store = make({ sendBatch });
    edit(store, 'A');

    await store.getState().flushSync();
    expect(store.getState().syncStatus).toBe('error');
    await vi.advanceTimersByTimeAsync(2000);

    expect(sendBatch).toHaveBeenCalledTimes(2);
    expect(store.getState()).toMatchObject({ revision: 2, syncStatus: 'saved' });
  });
});

describe('undo history across a page reload (spec-log #77)', () => {
  it('comes back after a reload of the same document [R-HS-05]', async () => {
    const storage = memoryStorage();
    const first = make({}, storage);
    edit(first, 'A');
    await first.getState().flushSync();

    const reloaded = createEditorStore({ sendBatch: server(2), storage });
    reloaded.getState().loadDocument(first.getState().document ?? sampleDocument(), 2);
    reloaded.getState().undo();

    expect(textOf(reloaded.getState().document)).toBe('Original text');
  });

  it('is dropped when the document on the server moved on [R-HS-05]', async () => {
    const storage = memoryStorage();
    const first = make({}, storage);
    edit(first, 'A');
    await first.getState().flushSync();

    const reloaded = createEditorStore({ sendBatch: server(5), storage });
    reloaded.getState().loadDocument(sampleDocument(5), 5);

    expect(reloaded.getState().canUndo()).toBe(false);
  });
});
