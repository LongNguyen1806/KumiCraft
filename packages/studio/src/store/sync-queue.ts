// Synchronisation of local edits to the server (SPEC-04.1 section 13.2). R-HS-01: one request at a
// time; edits made meanwhile go into the next batch, based on the revision the server last gave.
import type { DesignOperation, OperationBatch } from '@reactcraft/model';

import { ApiError } from '../api/http.ts';
import type { ApplyOperationsResponse } from '../api/workspace-client.ts';

export const SYNC_DEBOUNCE_MS = 300;
export const RETRY_MS = 2000;

export type SyncCallbacks = {
  readonly onSending: () => void;
  /** The server took a batch; `isIdle` when nothing else waits. */
  readonly onSaved: (revision: number, isIdle: boolean) => void;
  /** E017 (the server moved on) or E005 (a rule refused the batch): the local copy is wrong. */
  readonly onDiverged: (code: 'E017' | 'E005') => void;
  /** Network or server failure: the edits are kept and sent again later. */
  readonly onFailed: () => void;
};

type Meta = OperationBatch['meta'];

type QueueState = {
  pending: DesignOperation[];
  meta: Meta;
  acknowledged: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  running: Promise<void> | undefined;
};

const clearTimer = (state: QueueState) => {
  if (state.timer !== undefined) clearTimeout(state.timer);
  state.timer = undefined;
};

type Sender = (batch: OperationBatch) => Promise<ApplyOperationsResponse>;

/** Sends until nothing waits; edits arriving meanwhile join the loop. */
async function drain(
  state: QueueState,
  send: Sender,
  callbacks: SyncCallbacks,
  retry: () => void,
): Promise<void> {
  while (state.pending.length > 0) {
    const ops = state.pending;
    state.pending = [];
    callbacks.onSending();
    try {
      const result = await send({ baseRevision: state.acknowledged, ops, meta: state.meta });
      state.acknowledged = result.revision;
      callbacks.onSaved(state.acknowledged, state.pending.length === 0);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      if (code === 'E017' || code === 'E005') {
        state.pending = [];
        callbacks.onDiverged(code);
      } else {
        state.pending = [...ops, ...state.pending];
        callbacks.onFailed();
        retry();
      }
      return;
    }
  }
}

export function createSyncQueue(send: Sender, callbacks: SyncCallbacks) {
  const state: QueueState = {
    pending: [],
    meta: { source: 'user', label: 'edit' },
    acknowledged: 0,
    timer: undefined,
    running: undefined,
  };
  const later = (ms: number) => {
    clearTimer(state);
    state.timer = setTimeout(() => void flush(), ms);
  };

  async function flush(): Promise<void> {
    clearTimer(state);
    state.running ??= (async () => {
      try {
        await drain(state, send, callbacks, () => {
          later(RETRY_MS);
        });
      } finally {
        state.running = undefined;
      }
    })();
    await state.running;
  }

  return {
    /** A freshly loaded document at `revision`: nothing waits any more. */
    reset(revision: number) {
      clearTimer(state);
      state.pending = [];
      state.acknowledged = revision;
    },
    enqueue(ops: readonly DesignOperation[], batchMeta: Meta) {
      state.pending.push(...ops);
      state.meta = batchMeta;
      later(SYNC_DEBOUNCE_MS);
    },
    flush,
    /** R-HS-03: edits the server does not have yet. */
    hasUnsaved: () => state.pending.length > 0 || state.running !== undefined,
  };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;
