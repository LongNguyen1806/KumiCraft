// History REST client (SPEC-03 section 5.6, R-HI-01..10).
import type { HistoryState } from '@reactcraft/shared';

import { apiGet, apiPost } from './http.ts';

export async function fetchHistoryState(): Promise<HistoryState> {
  const result = await apiGet('history');
  return result as HistoryState;
}

export async function undoHistory(): Promise<HistoryState> {
  const result = await apiPost('history/undo');
  return result as HistoryState;
}

export async function redoHistory(): Promise<HistoryState> {
  const result = await apiPost('history/redo');
  return result as HistoryState;
}
