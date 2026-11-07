// Last usage each agent reported in the chat (K9.5): plan limits, model, tokens; kept per browser.
import type { AgentId, AgentLimit, AgentUsage } from '@kumicraft/shared';
import { AgentUsageSchema } from '@kumicraft/shared';
import { create } from 'zustand';

import { isRecord } from '../../api/http.ts';

export type AgentUsageView = AgentUsage & {
  /** When the agent last reported, ISO time. */
  readonly updatedAt: string;
};

type UsageState = {
  readonly byAgent: Readonly<Partial<Record<AgentId, AgentUsageView>>>;
  /** The agent the chat talks to now: usage events carry no agent id. */
  readonly current?: AgentId | undefined;
  readonly setCurrent: (id: AgentId | undefined) => void;
  readonly record: (usage: AgentUsage, now?: Date) => void;
};

const STORAGE_KEY = 'kumicraft.agentUsage';
const StoredUsageSchema = AgentUsageSchema.extend({
  updatedAt: AgentUsageSchema.shape.model.unwrap(),
});

function load(): Partial<Record<AgentId, AgentUsageView>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? undefined;
    if (raw === undefined) return {};
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return {};
    const out: Partial<Record<AgentId, AgentUsageView>> = {};
    for (const id of ['claude', 'agy'] as const) {
      const parsed = StoredUsageSchema.safeParse(data[id]);
      if (parsed.success) out[id] = parsed.data;
    }
    return out;
  } catch {
    return {};
  }
}

function save(byAgent: Partial<Record<AgentId, AgentUsageView>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(byAgent));
  } catch {
    // Private mode or full storage: the numbers stay for this session only.
  }
}

export const useUsageStore = create<UsageState>((set, get) => ({
  byAgent: load(),
  setCurrent: (id) => {
    set({ current: id });
  },
  record: (usage, now = new Date()) => {
    const id = get().current;
    if (id === undefined) return;
    // A limit report and the turn's result come apart: keep what each one brings.
    const next = {
      ...get().byAgent,
      [id]: { ...get().byAgent[id], ...usage, updatedAt: now.toISOString() },
    };
    set({ byAgent: next });
    save(next);
  },
}));

/** The larger share used of the two windows, or undefined when none is known. */
export function highestUse(usage: AgentUsage | undefined): number | undefined {
  const values = [usage?.fiveHour, usage?.week]
    .filter((w): w is AgentLimit => w !== undefined)
    .map((w) => w.used);
  return values.length === 0 ? undefined : Math.max(...values);
}
