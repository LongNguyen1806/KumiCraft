// Batch edit queue of the multi-element Inspector (SPEC-04 R-CB-15).
import type { BatchEditRequest, ClassStep, SetClassesEdit } from '@kumicraft/shared';
import {
  applyClassSteps,
  type ClassContext,
  type ClassValue,
  type PropertyId,
  type Scope,
} from '@kumicraft/style-tailwind';

import type { MultiTargetItem } from './types.ts';

export type MultiMutation = {
  readonly property: PropertyId;
  readonly value: ClassValue | undefined;
  readonly scope: Scope;
  readonly writePrefix: string;
};

/** One element's edit, sent as intents, and the class the Studio expects it to write. */
export type MultiEdit = { readonly edit: SetClassesEdit; readonly after: string };

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
): MultiEdit[] {
  const steps: ClassStep[] = mutations.map((m) => ({
    kind: 'value',
    property: m.property,
    scope: m.scope,
    value: m.value,
  }));
  const edits: MultiEdit[] = [];
  for (const item of items) {
    const src = item.source;
    if (!src || src.className.kind !== 'static') continue;
    const before = confirmed.get(item.ref.loc) ?? src.className.value;
    const out = applyClassSteps(before, steps, ctx);
    if (out.ok && out.value !== before) {
      edits.push({
        edit: { kind: 'setClasses', loc: item.ref.loc, tag: src.tag, before, steps },
        after: out.value,
      });
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
    const built = buildMultiEdits(items, this.confirmed, mutations, deps.ctx());
    const edits = built.map((b) => b.edit);
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
        for (const b of built) this.confirmed.set(b.edit.loc, b.after);
      } catch {
        this.confirmed = new Map();
      } finally {
        this.inFlight = false;
      }
    }
    if (this.pending.length > 0) void this.drain();
  }
}
