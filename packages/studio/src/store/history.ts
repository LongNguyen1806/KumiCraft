// Undo history (SPEC-04.1 sections 13.1 and 13.3): at most 200 entries (V-55); quick edits of the
// same property merge into one entry.
import type { DesignOperation } from '@reactcraft/model';

export const MAX_HISTORY = 200;
export const COALESCE_MS = 500;

export type HistoryEntry = {
  readonly id: string;
  /** For example "Change padding". */
  readonly label: string;
  readonly source: 'user' | 'ai';
  readonly forward: readonly DesignOperation[];
  /** Already in reverse order (V-51). */
  readonly inverse: readonly DesignOperation[];
  /** Time of the latest change in the entry, ms. */
  readonly at: number;
  readonly coalesceKey?: string;
};

const fieldNames = (op: { readonly set: object; readonly unset?: readonly string[] | undefined }) =>
  [...Object.keys(op.set), ...(op.unset ?? [])].sort().join(',');

/**
 * `setStyle:<node>:<breakpoint>:<state>:<properties>` or `setContent:<node>:<fields>` for a single
 * style or content change; other batches never merge.
 */
export function coalesceKeyOf(ops: readonly DesignOperation[]): string | undefined {
  const [op] = ops;
  if (ops.length !== 1 || op === undefined) return undefined;
  if (op.op === 'setStyle') {
    const { breakpoint = 'base', state = '' } = op.scope;
    return `setStyle:${op.nodeId}:${breakpoint}:${state}:${fieldNames(op)}`;
  }
  if (op.op === 'setContent') return `setContent:${op.nodeId}:${fieldNames(op)}`;
  return undefined;
}

/**
 * Adds `entry` on top of `stack`. It merges into the last entry when both have the same key, come
 * from the user and are at most 500 ms apart: the merged entry redoes the newest change and undoes
 * back to the state before the first one.
 */
export function pushEntry(stack: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const last = stack.at(-1);
  const merges =
    last !== undefined &&
    entry.coalesceKey !== undefined &&
    last.coalesceKey === entry.coalesceKey &&
    last.source === 'user' &&
    entry.source === 'user' &&
    entry.at - last.at <= COALESCE_MS;
  if (merges) {
    return [...stack.slice(0, -1), { ...last, forward: entry.forward, at: entry.at }];
  }
  const next = [...stack, entry];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}
