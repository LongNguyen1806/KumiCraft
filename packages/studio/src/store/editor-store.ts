// Editor Store & History Store (SPEC-04.1 section 6 & 13, ADR-FE-10, M-ES, M-HS).
import {
  applyBatch,
  type DesignDocument,
  type DesignOperation,
  err,
  invertOperation,
  type NodeRecord,
  normalize,
  ok,
  type OperationBatch,
  type Result,
} from '@reactcraft/model';
import { create } from 'zustand';

import { ApiError } from '../api/http.ts';
import { type ApplyOperationsResponse, sendOperations } from '../api/workspace-client.ts';

export type SyncStatus = 'saved' | 'saving' | 'error' | 'external_conflict';

export type HistoryStep = {
  readonly ops: readonly DesignOperation[];
  readonly inverseOps: readonly DesignOperation[];
  readonly meta: { readonly source: 'user' | 'ai'; readonly label: string };
};

export type EditorState = {
  readonly document: DesignDocument | undefined;
  readonly revision: number;
  readonly activePageId: string | undefined;
  readonly selectedNodeId: string | undefined;
  readonly hoveredNodeId: string | undefined;
  readonly flatNodes: Readonly<Record<string, NodeRecord>>;
  readonly syncStatus: SyncStatus;
  readonly undoStack: readonly HistoryStep[];
  readonly redoStack: readonly HistoryStep[];

  // Actions
  loadDocument(doc: DesignDocument, rev: number): void;
  setActivePageId(pageId: string): void;
  selectNode(nodeId: string | undefined): void;
  hoverNode(nodeId: string | undefined): void;
  dispatch(
    ops: readonly DesignOperation[],
    meta: { readonly source: 'user' | 'ai'; readonly label: string },
  ): Result<void>;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  setExternalConflict(): void;
  flushSync(): Promise<void>;
};

export type StoreDeps = {
  readonly sendBatch?: (batch: OperationBatch) => Promise<ApplyOperationsResponse>;
};

type HistoryTransition = {
  readonly newDoc: DesignDocument;
  readonly newUndo: readonly HistoryStep[];
  readonly newRedo: readonly HistoryStep[];
  readonly opsToQueue: readonly DesignOperation[];
};

function computeFlatNodes(doc: DesignDocument | undefined, activePageId: string | undefined) {
  if (doc === undefined || activePageId === undefined) return {};
  const page = doc.pages[activePageId];
  if (page === undefined) return {};
  return normalize(page.root).nodes;
}

function makeInverseOps(ops: readonly DesignOperation[], doc: DesignDocument): DesignOperation[] {
  const inverses: DesignOperation[] = [];
  let currentDoc = doc;
  for (const op of ops) {
    inverses.unshift(invertOperation(currentDoc, op));
    const applied = applyBatch(currentDoc, [op]);
    if (applied.ok) currentDoc = applied.value.doc;
  }
  return inverses;
}

function applyUndo(state: EditorState): HistoryTransition | undefined {
  if (state.undoStack.length === 0 || state.document === undefined) return undefined;
  const step = state.undoStack[state.undoStack.length - 1];
  if (step === undefined) return undefined;
  const applied = applyBatch(state.document, step.inverseOps);
  if (!applied.ok) return undefined;
  return {
    newDoc: applied.value.doc,
    newUndo: state.undoStack.slice(0, -1),
    newRedo: [...state.redoStack, step],
    opsToQueue: step.inverseOps,
  };
}

function applyRedo(state: EditorState): HistoryTransition | undefined {
  if (state.redoStack.length === 0 || state.document === undefined) return undefined;
  const step = state.redoStack[state.redoStack.length - 1];
  if (step === undefined) return undefined;
  const applied = applyBatch(state.document, step.ops);
  if (!applied.ok) return undefined;
  return {
    newDoc: applied.value.doc,
    newUndo: [...state.undoStack, step],
    newRedo: state.redoStack.slice(0, -1),
    opsToQueue: step.ops,
  };
}

type SyncSender = (batch: OperationBatch) => Promise<ApplyOperationsResponse>;

function createSyncQueue(syncApi: SyncSender) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: DesignOperation[] = [];
  let lastMeta: HistoryStep['meta'] | undefined;
  let baseRev = 1;

  async function perform(set: (fn: Partial<EditorState>) => void): Promise<void> {
    if (pending.length === 0) return;
    const opsToSend = [...pending];
    pending = [];
    const base = baseRev;
    const meta = lastMeta ?? { source: 'user', label: 'edit' };
    set({ syncStatus: 'saving' });
    try {
      const res = await syncApi({ baseRevision: base, ops: opsToSend, meta });
      set({ revision: res.revision, syncStatus: 'saved' });
      baseRev = res.revision;
    } catch (error) {
      const isConflict = error instanceof ApiError && error.code === 'E017';
      set({ syncStatus: isConflict ? 'external_conflict' : 'error' });
    }
  }

  return {
    enqueue(ops: readonly DesignOperation[], currentRev: number, meta?: HistoryStep['meta']) {
      if (pending.length === 0) baseRev = currentRev;
      pending.push(...ops);
      if (meta !== undefined) lastMeta = meta;
    },
    reset(rev: number) {
      pending = [];
      lastMeta = undefined;
      baseRev = rev;
    },
    schedule(set: (fn: Partial<EditorState>) => void) {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        void perform(set);
      }, 300);
    },
    async flush(set: (fn: Partial<EditorState>) => void) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      await perform(set);
    },
  };
}

type SyncQueue = ReturnType<typeof createSyncQueue>;

function handleDispatch(
  get: () => EditorState,
  set: (fn: Partial<EditorState>) => void,
  queue: SyncQueue,
  ops: readonly DesignOperation[],
  meta: HistoryStep['meta'],
): Result<void> {
  const state = get();
  if (state.document === undefined) {
    return err({ code: 'E015', params: { resource: 'document' } });
  }
  const applied = applyBatch(state.document, ops);
  if (!applied.ok) return applied;

  const step: HistoryStep = { ops, inverseOps: makeInverseOps(ops, state.document), meta };
  queue.enqueue(ops, state.revision, meta);
  const newDoc = applied.value.doc;
  set({
    document: newDoc,
    flatNodes: computeFlatNodes(newDoc, state.activePageId),
    undoStack: [...state.undoStack, step],
    redoStack: [],
  });
  queue.schedule(set);
  return ok(undefined);
}

function handleHistory(
  get: () => EditorState,
  set: (fn: Partial<EditorState>) => void,
  queue: SyncQueue,
  next: HistoryTransition | undefined,
): void {
  if (next === undefined) return;
  queue.enqueue(next.opsToQueue, get().revision, { source: 'user', label: 'history' });
  set({
    document: next.newDoc,
    flatNodes: computeFlatNodes(next.newDoc, get().activePageId),
    undoStack: next.newUndo,
    redoStack: next.newRedo,
  });
  queue.schedule(set);
}

const initialEditorState = {
  document: undefined,
  revision: 1,
  activePageId: undefined,
  selectedNodeId: undefined,
  hoveredNodeId: undefined,
  flatNodes: {},
  syncStatus: 'saved' as SyncStatus,
  undoStack: [] as readonly HistoryStep[],
  redoStack: [] as readonly HistoryStep[],
};

export function createEditorStore(deps?: StoreDeps) {
  const queue = createSyncQueue(deps?.sendBatch ?? sendOperations);

  return create<EditorState>((set, get) => ({
    ...initialEditorState,
    loadDocument(doc, rev) {
      queue.reset(rev);
      const activePageId = doc.workspace.pageOrder[0];
      set({
        document: doc,
        revision: rev,
        activePageId,
        selectedNodeId: undefined,
        hoveredNodeId: undefined,
        flatNodes: computeFlatNodes(doc, activePageId),
        syncStatus: 'saved',
        undoStack: [],
        redoStack: [],
      });
    },
    setActivePageId: (activePageId) => {
      set({
        activePageId,
        selectedNodeId: undefined,
        hoveredNodeId: undefined,
        flatNodes: computeFlatNodes(get().document, activePageId),
      });
    },
    selectNode: (selectedNodeId) => {
      set({ selectedNodeId });
    },
    hoverNode: (hoveredNodeId) => {
      set({ hoveredNodeId });
    },
    dispatch: (ops, meta) => handleDispatch(get, set, queue, ops, meta),
    undo: () => {
      handleHistory(get, set, queue, applyUndo(get()));
    },
    redo: () => {
      handleHistory(get, set, queue, applyRedo(get()));
    },
    canUndo: () => get().undoStack.length > 0,
    canRedo: () => get().redoStack.length > 0,
    setExternalConflict: () => {
      set({ syncStatus: 'external_conflict' });
    },
    flushSync: async () => {
      await queue.flush(set);
    },
  }));
}

export const useEditorStore = createEditorStore();
