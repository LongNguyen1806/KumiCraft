// History store for Studio (SPEC-04 M-HI, R-HI-01..10).
import type { HistoryLabel, HistoryState } from '@reactcraft/shared';
import { useEffect } from 'react';
import { create } from 'zustand';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { fetchHistoryState, redoHistory, undoHistory } from '../../api/history-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';

/** The failed Undo/Redo; the Studio translates it where it is shown (R-HI-10, V-80). */
export type HistoryError = {
  readonly code: string;
  readonly file?: string | undefined;
  readonly params?: Readonly<Record<string, unknown>> | undefined;
};

export type HistoryStoreState = {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoCount: number;
  readonly redoCount: number;
  readonly undoLabel?: HistoryLabel | undefined;
  readonly redoLabel?: HistoryLabel | undefined;
  readonly isApplying: boolean;
  readonly error?: HistoryError | undefined;

  readonly load: () => Promise<void>;
  readonly undo: () => Promise<void>;
  readonly redo: () => Promise<void>;
  readonly applyState: (state: HistoryState) => void;
  readonly clearError: () => void;
  readonly reset: () => void;
};

function parseHistoryError(err: unknown): HistoryError {
  const info = toErrorInfo(err);
  const file = typeof info.params?.['file'] === 'string' ? info.params['file'] : undefined;
  return { code: info.code, file, params: info.params };
}

function stateToStore(
  state: HistoryState,
): Pick<
  HistoryStoreState,
  'canUndo' | 'canRedo' | 'undoCount' | 'redoCount' | 'undoLabel' | 'redoLabel'
> {
  return {
    canUndo: state.undoCount > 0,
    canRedo: state.redoCount > 0,
    undoCount: state.undoCount,
    redoCount: state.redoCount,
    undoLabel: state.undo,
    redoLabel: state.redo,
  };
}

type SetHistory = (
  partial: Partial<HistoryStoreState> | ((state: HistoryStoreState) => Partial<HistoryStoreState>),
) => void;
type GetHistory = () => HistoryStoreState;

const INITIAL_HISTORY_STATE = {
  canUndo: false,
  canRedo: false,
  undoCount: 0,
  redoCount: 0,
  undoLabel: undefined,
  redoLabel: undefined,
  isApplying: false,
  error: undefined,
} as const;

async function executeUndo(set: SetHistory, get: GetHistory): Promise<void> {
  const { canUndo, isApplying } = get();
  if (!canUndo || isApplying) return;
  set({ isApplying: true, error: undefined });
  try {
    const next = await undoHistory();
    set({ ...stateToStore(next), isApplying: false });
  } catch (err) {
    set({ isApplying: false, error: parseHistoryError(err) });
  }
}

async function executeRedo(set: SetHistory, get: GetHistory): Promise<void> {
  const { canRedo, isApplying } = get();
  if (!canRedo || isApplying) return;
  set({ isApplying: true, error: undefined });
  try {
    const next = await redoHistory();
    set({ ...stateToStore(next), isApplying: false });
  } catch (err) {
    set({ isApplying: false, error: parseHistoryError(err) });
  }
}

export const useHistoryStore = create<HistoryStoreState>((set, get) => ({
  ...INITIAL_HISTORY_STATE,
  load: async () => {
    try {
      const state = await fetchHistoryState();
      set(stateToStore(state));
    } catch {
      // Ignored if server is restarting or project closed
    }
  },
  undo: () => executeUndo(set, get),
  redo: () => executeRedo(set, get),
  applyState: (state: HistoryState) => {
    set(stateToStore(state));
  },
  clearError: () => {
    set({ error: undefined });
  },
  reset: () => {
    set(INITIAL_HISTORY_STATE);
  },
}));

export function useHistorySync(enabled: boolean = true): void {
  const load = useHistoryStore((s) => s.load);
  const applyState = useHistoryStore((s) => s.applyState);

  useEffect(() => {
    if (!enabled) return undefined;
    void load();

    const client = createEventsClient({
      onEvent: (event: StudioServerEvent) => {
        if (event.type === 'history.changed') {
          applyState(event.payload as HistoryState);
        }
      },
    });

    return () => {
      client.close();
    };
  }, [enabled, load, applyState]);
}
