// Turn metadata and conversation persistence (WP-3.03b, R-AG-16).
import {
  type AgentId,
  AgentIdSchema,
  type TurnSummary,
  TurnSummarySchema,
} from '@kumicraft/shared';
import { z } from 'zod';

import { ok, type Result } from '../../kernel/result.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

// Summaries are small: keep enough for the session list (K9.5); undo snapshots stay at 20.
const DEFAULT_KEEP_TURNS = 100;
const DEFAULT_REVERTIBLE_TURNS = 20;

export const SummariesFileSchema = z.strictObject({
  version: z.literal(1),
  turns: z.array(TurnSummarySchema),
});

export const ConversationFileSchema = z.strictObject({
  version: z.literal(1),
  agent: AgentIdSchema,
  id: z.string().min(1).max(200),
});

export type TurnStore = {
  list(projectId: string): Promise<readonly TurnSummary[]>;
  get(projectId: string, turnId: string): Promise<TurnSummary | undefined>;
  save(projectId: string, summary: TurnSummary): Promise<Result<void>>;
  /** Drops these turns from the session list (a chat session removed from KumiCraft). */
  remove(projectId: string, turnIds: readonly string[]): Promise<Result<void>>;
  conversation(
    projectId: string,
  ): Promise<{ readonly agent: AgentId; readonly id: string } | undefined>;
  setConversation(
    projectId: string,
    value: { readonly agent: AgentId; readonly id: string } | undefined,
  ): Promise<Result<void>>;
};

export type TurnStoreDeps = {
  readonly fs: FileSystemPort;
  readonly dataDir: string;
};

export type TurnStoreOptions = {
  readonly keepTurns?: number | undefined;
  /** Turns past this many have no undo snapshot left, so they cannot be reverted. */
  readonly revertibleTurns?: number | undefined;
};

function summariesRelPath(projectId: string): string {
  return `turns/${projectId}/meta/summaries.json`;
}

function conversationRelPath(projectId: string): string {
  return `turns/${projectId}/meta/conversation.json`;
}

async function loadSummaries(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
): Promise<readonly TurnSummary[]> {
  const readRes = await fs.readText(dataDir, summariesRelPath(projectId));
  if (!readRes.ok) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(readRes.value);
    const validated = SummariesFileSchema.safeParse(parsed);
    return validated.success ? validated.data.turns : [];
  } catch {
    return [];
  }
}

async function loadConversation(
  fs: FileSystemPort,
  dataDir: string,
  projectId: string,
): Promise<{ readonly agent: AgentId; readonly id: string } | undefined> {
  const readRes = await fs.readText(dataDir, conversationRelPath(projectId));
  if (!readRes.ok) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(readRes.value);
    const validated = ConversationFileSchema.safeParse(parsed);
    return validated.success ? { agent: validated.data.agent, id: validated.data.id } : undefined;
  } catch {
    return undefined;
  }
}

export function createTurnStore(deps: TurnStoreDeps, options: TurnStoreOptions = {}): TurnStore {
  const keepTurns = options.keepTurns ?? DEFAULT_KEEP_TURNS;
  const revertibleTurns = options.revertibleTurns ?? DEFAULT_REVERTIBLE_TURNS;

  return {
    list: (projectId) => loadSummaries(deps.fs, deps.dataDir, projectId),

    async get(projectId, turnId) {
      const turns = await loadSummaries(deps.fs, deps.dataDir, projectId);
      return turns.find((t) => t.id === turnId);
    },

    async save(projectId, summary) {
      const current = await loadSummaries(deps.fs, deps.dataDir, projectId);
      const index = current.findIndex((t) => t.id === summary.id);
      const updated = [...current];
      if (index >= 0) {
        updated[index] = summary;
      } else {
        updated.unshift(summary);
      }
      const trimmed = updated
        .slice(0, keepTurns)
        .map((t, i) => (i >= revertibleTurns && t.revertible ? { ...t, revertible: false } : t));
      const json = JSON.stringify({ version: 1, turns: trimmed }, undefined, 2);
      await deps.fs.writeTextAtomic(deps.dataDir, summariesRelPath(projectId), json);
      return ok(undefined);
    },

    async remove(projectId, turnIds) {
      const current = await loadSummaries(deps.fs, deps.dataDir, projectId);
      const drop = new Set(turnIds);
      const kept = current.filter((t) => !drop.has(t.id));
      const json = JSON.stringify({ version: 1, turns: kept }, undefined, 2);
      await deps.fs.writeTextAtomic(deps.dataDir, summariesRelPath(projectId), json);
      return ok(undefined);
    },

    conversation: (projectId) => loadConversation(deps.fs, deps.dataDir, projectId),

    async setConversation(projectId, value) {
      const relPath = conversationRelPath(projectId);
      if (value === undefined) {
        await deps.fs.remove(deps.dataDir, relPath);
        return ok(undefined);
      }
      const json = JSON.stringify({ version: 1, agent: value.agent, id: value.id }, undefined, 2);
      await deps.fs.writeTextAtomic(deps.dataDir, relPath, json);
      return ok(undefined);
    },
  };
}
