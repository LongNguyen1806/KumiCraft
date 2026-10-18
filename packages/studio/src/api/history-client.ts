// History REST client (SPEC-03 section 5.6, R-HI-01..10).
import { type HistoryState, HistoryStateSchema, HistoryStepSchema } from '@reactcraft/shared';

import { apiGet, apiPost } from './http.ts';

export async function fetchHistoryState(): Promise<HistoryState> {
  return HistoryStateSchema.parse(await apiGet('history'));
}

/** Undo answers a `HistoryStep` (`{ state, files }`); the Studio keeps the state part. */
export async function undoHistory(): Promise<HistoryState> {
  return HistoryStepSchema.parse(await apiPost('history/undo')).state;
}

export async function redoHistory(): Promise<HistoryState> {
  return HistoryStepSchema.parse(await apiPost('history/redo')).state;
}
