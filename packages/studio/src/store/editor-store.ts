// Editor Store and history (SPEC-04.1 sections 6 and 13, ADR-FE-10, M-HS): the document being
// edited, the selection, Undo/Redo and the synchronisation to the server.
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
import { create, type StoreApi } from 'zustand';

import {
  type ApplyOperationsResponse,
  type DocumentResponse,
  fetchDocument,
  sendOperations,
} from '../api/workspace-client.ts';
import { coalesceKeyOf, type HistoryEntry, pushEntry } from './history.ts';
import {
  clearHistory,
  type HistoryStorage,
  restoreHistory,
  saveHistory,
  sessionHistoryStorage,
} from './history-persistence.ts';
import { createSyncQueue, type SyncQueue } from './sync-queue.ts';

export type { HistoryEntry } from './history.ts';

export type SyncStatus = 'saved' | 'saving' | 'error' | 'external_conflict';

/** Shown once after the Studio reloaded the document: E017 changed elsewhere, E005 refused. */
export type SyncNotice = 'E017' | 'E005';

type Meta = {
  readonly source: 'user' | 'ai';
  readonly label: string;
  /** `false` keeps this change as its own Undo step even right after a similar one. */
  readonly coalesce?: boolean;
};

export type EditorState = {
  readonly document: DesignDocument | undefined;
  readonly revision: number;
  readonly activePageId: string | undefined;
  readonly selectedNodeId: string | undefined;
  readonly selectedNodeIds: readonly string[];
  readonly hoveredNodeId: string | undefined;
  readonly flatNodes: Readonly<Record<string, NodeRecord>>;
  readonly syncStatus: SyncStatus;
  readonly notice: SyncNotice | undefined;
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];

  readonly loadDocument: (doc: DesignDocument, revision: number) => void;
  readonly setActivePageId: (pageId: string) => void;
  readonly selectNode: (nodeId: string | undefined) => void;
  readonly selectNodes: (nodeIds: readonly string[]) => void;
  readonly toggleNodeSelection: (nodeId: string) => void;
  readonly hoverNode: (nodeId: string | undefined) => void;
  readonly dispatch: (ops: readonly DesignOperation[], meta: Meta) => Result<void>;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: () => boolean;
  readonly canRedo: () => boolean;
  readonly setExternalConflict: () => void;
  readonly flushSync: () => Promise<void>;
  /** R-HS-03: edits the server does not have yet (asked before the tab closes). */
  readonly hasUnsavedChanges: () => boolean;
};

export type StoreDeps = {
  readonly sendBatch?: (batch: OperationBatch) => Promise<ApplyOperationsResponse>;
  readonly fetchDocument?: () => Promise<DocumentResponse>;
  /** Where the history survives a reload; sessionStorage by default. */
  readonly storage?: HistoryStorage | undefined;
  readonly now?: () => number;
};

type Set = StoreApi<EditorState>['setState'];
type Get = StoreApi<EditorState>['getState'];

type FlatNodes = Readonly<Record<string, NodeRecord>>;

/**
 * Keeps the old record of every node that did not change, so a component reading one node by id
 * re-renders only when that node changes (R-CV-05).
 */
function reuseUnchanged(previous: FlatNodes, next: FlatNodes): FlatNodes {
  const result: Record<string, NodeRecord> = {};
  for (const [id, record] of Object.entries(next)) {
    const old = previous[id];
    result[id] = old !== undefined && JSON.stringify(old) === JSON.stringify(record) ? old : record;
  }
  return result;
}

function flatNodesOf(
  doc: DesignDocument | undefined,
  pageId: string | undefined,
  previous: FlatNodes = {},
): FlatNodes {
  const page = doc === undefined || pageId === undefined ? undefined : doc.pages[pageId];
  return page === undefined ? {} : reuseUnchanged(previous, normalize(page.root).nodes);
}

/** Inverse of a batch, last operation first (V-51). */
function inverseOf(ops: readonly DesignOperation[], doc: DesignDocument): DesignOperation[] {
  const inverse: DesignOperation[] = [];
  let current = doc;
  for (const op of ops) {
    inverse.unshift(invertOperation(current, op));
    const applied = applyBatch(current, [op]);
    if (applied.ok) current = applied.value.doc;
  }
  return inverse;
}

let entryCounter = 0;
const nextEntryId = () => `h_${String(++entryCounter)}`;

type Context = {
  readonly get: Get;
  readonly set: Set;
  readonly queue: SyncQueue;
  readonly deps: Required<Pick<StoreDeps, 'now'>> & StoreDeps;
};

function pruneSelection(selectedNodeIds: readonly string[], flatNodes: FlatNodes) {
  const valid = selectedNodeIds.filter((id) => flatNodes[id] !== undefined);
  return {
    selectedNodeIds: valid,
    selectedNodeId: valid.at(-1),
  };
}

function dispatch(context: Context, ops: readonly DesignOperation[], meta: Meta): Result<void> {
  const { get, set, queue, deps } = context;
  const state = get();
  if (state.document === undefined) return err({ code: 'E015', params: { resource: 'document' } });
  const applied = applyBatch(state.document, ops);
  if (!applied.ok) return applied;
  const coalesceKey = meta.coalesce === false ? undefined : coalesceKeyOf(ops);
  const entry: HistoryEntry = {
    id: nextEntryId(),
    label: meta.label,
    source: meta.source,
    forward: ops,
    inverse: inverseOf(ops, state.document),
    at: deps.now(),
    ...(coalesceKey === undefined ? {} : { coalesceKey }),
  };
  const nextFlat = flatNodesOf(applied.value.doc, state.activePageId, state.flatNodes);
  const selection = pruneSelection(state.selectedNodeIds, nextFlat);
  set({
    document: applied.value.doc,
    flatNodes: nextFlat,
    selectedNodeIds: selection.selectedNodeIds,
    selectedNodeId: selection.selectedNodeId,
    undoStack: pushEntry(state.undoStack, entry),
    redoStack: [],
    notice: undefined,
  });
  queue.enqueue(ops, meta);
  return ok(undefined);
}

/** R-HS-02: Undo applies the inverse and moves the entry to Redo; Redo does the opposite. */
function travel(context: Context, direction: 'undo' | 'redo'): void {
  const { get, set, queue } = context;
  const state = get();
  const from = direction === 'undo' ? state.undoStack : state.redoStack;
  const entry = from.at(-1);
  if (entry === undefined || state.document === undefined) return;
  const ops = direction === 'undo' ? entry.inverse : entry.forward;
  const applied = applyBatch(state.document, ops);
  if (!applied.ok) return;
  const { coalesceKey: _merged, ...moved } = entry;
  const nextFlat = flatNodesOf(applied.value.doc, state.activePageId, state.flatNodes);
  const selection = pruneSelection(state.selectedNodeIds, nextFlat);
  set({
    document: applied.value.doc,
    flatNodes: nextFlat,
    selectedNodeIds: selection.selectedNodeIds,
    selectedNodeId: selection.selectedNodeId,
    undoStack: direction === 'undo' ? state.undoStack.slice(0, -1) : [...state.undoStack, moved],
    redoStack: direction === 'undo' ? [...state.redoStack, moved] : state.redoStack.slice(0, -1),
  });
  const label = `${direction === 'undo' ? 'Undo' : 'Redo'}: ${entry.label}`;
  queue.enqueue(ops, { source: entry.source, label });
}

function load(context: Context, doc: DesignDocument, revision: number, keepHistory: boolean) {
  context.queue.reset(revision);
  const saved = keepHistory
    ? restoreHistory(context.deps.storage, doc.workspace.id, revision)
    : undefined;
  if (saved === undefined) clearHistory(context.deps.storage);
  const activePageId = doc.workspace.pageOrder[0];
  context.set({
    document: doc,
    revision,
    activePageId,
    selectedNodeId: undefined,
    selectedNodeIds: [],
    hoveredNodeId: undefined,
    flatNodes: flatNodesOf(doc, activePageId),
    syncStatus: 'saved',
    undoStack: saved?.undo ?? [],
    redoStack: saved?.redo ?? [],
  });
}

/** E017 or E005: the server copy is the truth. Reload it and drop the history (section 13.2). */
async function resync(context: Context, code: SyncNotice): Promise<void> {
  const fetchLatest = context.deps.fetchDocument ?? fetchDocument;
  try {
    const latest = await fetchLatest();
    load(context, latest.document, latest.revision, false);
    context.set({ notice: code });
  } catch {
    context.set({ syncStatus: 'error' });
  }
}

function syncCallbacks(context: () => Context) {
  return {
    onSending: () => {
      context().set({ syncStatus: 'saving' });
    },
    onSaved: (revision: number, isIdle: boolean) => {
      const { get, set, deps } = context();
      set({ revision, ...(isIdle ? { syncStatus: 'saved' as const } : {}) });
      const { document, undoStack, redoStack } = get();
      if (isIdle && document !== undefined) {
        saveHistory(deps.storage, {
          workspaceId: document.workspace.id,
          revision,
          undo: undoStack,
          redo: redoStack,
        });
      }
    },
    onDiverged: (code: SyncNotice) => {
      context().set({ syncStatus: code === 'E017' ? 'external_conflict' : 'error' });
      void resync(context(), code);
    },
    onFailed: () => {
      context().set({ syncStatus: 'error' });
    },
  };
}

const initialState = {
  document: undefined,
  revision: 0,
  activePageId: undefined,
  selectedNodeId: undefined,
  selectedNodeIds: [] as readonly string[],
  hoveredNodeId: undefined,
  flatNodes: {},
  syncStatus: 'saved' as SyncStatus,
  notice: undefined,
  undoStack: [] as readonly HistoryEntry[],
  redoStack: [] as readonly HistoryEntry[],
};

function buildSelectionActions(ctx: Context) {
  const { set, get } = ctx;
  return {
    selectNode: (selectedNodeId: string | undefined) => {
      set({
        selectedNodeId,
        selectedNodeIds: selectedNodeId === undefined ? [] : [selectedNodeId],
      });
    },
    selectNodes: (selectedNodeIds: readonly string[]) => {
      const valid = selectedNodeIds.filter((id) => get().flatNodes[id] !== undefined);
      set({ selectedNodeIds: valid, selectedNodeId: valid.at(-1) });
    },
    toggleNodeSelection: (nodeId: string) => {
      const current = get().selectedNodeIds;
      const next = current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId];
      set({ selectedNodeIds: next, selectedNodeId: next.at(-1) });
    },
    hoverNode: (hoveredNodeId: string | undefined) => {
      set({ hoveredNodeId });
    },
  };
}

function buildStoreActions(ctx: Context) {
  const { set, get, queue } = ctx;
  return {
    ...initialState,
    loadDocument: (doc: DesignDocument, revision: number) => {
      load(ctx, doc, revision, true);
    },
    setActivePageId: (activePageId: string) => {
      set({
        activePageId,
        selectedNodeId: undefined,
        selectedNodeIds: [],
        hoveredNodeId: undefined,
        flatNodes: flatNodesOf(get().document, activePageId),
      });
    },
    ...buildSelectionActions(ctx),
    dispatch: (ops: readonly DesignOperation[], meta: Meta) => dispatch(ctx, ops, meta),
    undo: () => {
      travel(ctx, 'undo');
    },
    redo: () => {
      travel(ctx, 'redo');
    },
    canUndo: () => get().undoStack.length > 0,
    canRedo: () => get().redoStack.length > 0,
    setExternalConflict: () => {
      set({ syncStatus: 'external_conflict' });
    },
    flushSync: () => queue.flush(),
    hasUnsavedChanges: () => queue.hasUnsaved(),
  };
}

export function createEditorStore(deps: StoreDeps = {}) {
  const resolved = { storage: sessionHistoryStorage(), now: () => Date.now(), ...deps };
  let context: Context | undefined;
  const queue = createSyncQueue(
    resolved.sendBatch ?? sendOperations,
    syncCallbacks(() => context as Context),
  );

  return create<EditorState>((set, get) => {
    context = { get, set, queue, deps: resolved };
    return buildStoreActions(context);
  });
}

export const useEditorStore = createEditorStore();
