// Undo history that survives a page reload (F5) or a reconnect, but not a closed tab: it lives in
// sessionStorage (spec-log #77). It is only restored on the exact document it was made for.
import type { HistoryEntry } from './history.ts';

const KEY = 'reactcraft.history';

export type HistorySnapshot = {
  readonly workspaceId: string;
  /** Revision of the document once every entry was saved on the server. */
  readonly revision: number;
  readonly undo: readonly HistoryEntry[];
  readonly redo: readonly HistoryEntry[];
};

export type HistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function saveHistory(storage: HistoryStorage | undefined, snapshot: HistorySnapshot): void {
  try {
    storage?.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Full or refused storage: undo still works until the page is reloaded.
  }
}

export function clearHistory(storage: HistoryStorage | undefined): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The saved history of `workspaceId` at `revision`, or undefined when it does not match. */
export function restoreHistory(
  storage: HistoryStorage | undefined,
  workspaceId: string,
  revision: number,
): HistorySnapshot | undefined {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? '{}') as Partial<HistorySnapshot> | undefined;
    const matches =
      saved?.workspaceId === workspaceId &&
      saved.revision === revision &&
      Array.isArray(saved.undo) &&
      Array.isArray(saved.redo);
    return matches ? (saved as HistorySnapshot) : undefined;
  } catch {
    return undefined;
  }
}

/** sessionStorage when the browser allows it. */
export function sessionHistoryStorage(): HistoryStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}
