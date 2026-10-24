// Batch edit queue of the multi-element Inspector (SPEC-04 R-CB-15).
import type {
  BatchEditRequest,
  ClassContext,
  ClassValue,
  PropertyId,
  Scope,
  SetClassNameEdit,
} from '@kumicraft/shared';
import { writeValue } from '@kumicraft/shared';

import type { MultiTargetItem } from './types.ts';

export type MultiMutation = {
  readonly property: PropertyId;
  readonly value: ClassValue | undefined;
  readonly scope: Scope;
  readonly writePrefix: string;
};

export type MultiEditQueueDeps = {
  readonly getItems: () => readonly MultiTargetItem[];
  readonly ctx: () => ClassContext;
  readonly send: (req: BatchEditRequest) => Promise<void>;
};

/**
 * Applies `mutations` in order to the latest known class of every element. The edits are built when
 * the request leaves, not when the field changes, so a change made while the previous one is still
 * saving starts from that saved class instead of the stale source (no E017, no lost change).
 */
export function buildMultiEdits(
  items: readonly MultiTargetItem[],
  confirmed: ReadonlyMap<string, string>,
  mutations: readonly MultiMutation[],
  ctx: ClassContext,
): SetClassNameEdit[] {
  const edits: SetClassNameEdit[] = [];
  for (const item of items) {
    const src = item.source;
    if (!src || src.className.kind !== 'static') continue;
    const before = confirmed.get(item.ref.loc) ?? src.className.value;
    let after = before;
    for (const m of mutations) after = writeValue(after, m.property, m.scope, m.value, ctx);
    if (after !== before) {
      edits.push({ kind: 'setClassName', loc: item.ref.loc, tag: src.tag, before, after });
    }
  }
  return edits;
}

export class MultiEditQueue {
  private deps: MultiEditQueueDeps | undefined;
  private readonly throttleMs: number;
  private pending: MultiMutation[] = [];
  private confirmed = new Map<string, string>();
  private inFlight = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(throttleMs = 150) {
    this.throttleMs = throttleMs;
  }

  /** The current items, class context and sender (set from an effect, read when a batch leaves). */
  setDeps(deps: MultiEditQueueDeps): void {
    this.deps = deps;
  }

  schedule(mutation: MultiMutation): void {
    // A newer value of the same field replaces the older one still waiting.
    this.pending = [
      ...this.pending.filter(
        (m) => m.property !== mutation.property || m.writePrefix !== mutation.writePrefix,
      ),
      mutation,
    ];
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.drain();
    }, this.throttleMs);
  }

  /** The sources were reloaded from the server: they are now the latest known classes. */
  resetConfirmed(): void {
    if (!this.inFlight && this.pending.length === 0) this.confirmed = new Map();
  }

  clear(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = [];
  }

  private async drain(): Promise<void> {
    const deps = this.deps;
    if (deps === undefined || this.inFlight || this.pending.length === 0) return;
    const mutations = this.pending;
    this.pending = [];
    const items = deps.getItems();
    const edits = buildMultiEdits(items, this.confirmed, mutations, deps.ctx());
    if (edits.length > 0) {
      this.inFlight = true;
      const locs = items.map((i) => i.ref.loc).join(',');
      const last = mutations[mutations.length - 1];
      const coalesceKey =
        mutations.length === 1 && last !== undefined
          ? `multi|${last.property}|${last.writePrefix}|${locs}`
          : undefined;
      try {
        await deps.send(coalesceKey === undefined ? { edits } : { edits, coalesceKey });
        for (const e of edits) this.confirmed.set(e.loc, e.after);
      } catch {
        this.confirmed = new Map();
      } finally {
        this.inFlight = false;
      }
    }
    if (this.pending.length > 0) void this.drain();
  }
}
