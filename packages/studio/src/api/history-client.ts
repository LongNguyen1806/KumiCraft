// History REST client (SPEC-03 section 5.6, R-HI-01..10).
import { type HistoryState, HistoryStateSchema, HistoryStepSchema } from '@kumicraft/shared';

import { apiGet, apiPost, parseResponse } from './http.ts';

export async function fetchHistoryState(): Promise<HistoryState> {
  return parseResponse(HistoryStateSchema, await apiGet('history'));
}

/** Undo answers a `HistoryStep` (`{ state, files }`); the Studio keeps the state part. */
export async function undoHistory(): Promise<HistoryState> {
  return parseResponse(HistoryStepSchema, await apiPost('history/undo')).state;
}

export async function redoHistory(): Promise<HistoryState> {
  return parseResponse(HistoryStepSchema, await apiPost('history/redo')).state;
}
