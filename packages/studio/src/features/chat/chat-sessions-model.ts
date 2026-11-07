// Chat sessions built from turn history (K9.5): one per agent conversation, newest first.
import type { AgentId, TurnSummary } from '@kumicraft/shared';

export type ChatSession = {
  /** The agent's conversation id; absent for turns saved before sessions existed. */
  readonly id?: string | undefined;
  readonly agent: AgentId;
  /** The first request of the session. */
  readonly title: string;
  readonly turnCount: number;
  readonly lastAt: string;
};

/** Turns of one session, oldest first; `id` absent: the turns saved before sessions existed. */
export function turnsOfSession(
  turns: readonly TurnSummary[],
  id: string | undefined,
): readonly TurnSummary[] {
  return turns
    .filter((t) => t.conversation === id)
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function groupSessions(turns: readonly TurnSummary[]): readonly ChatSession[] {
  const groups = new Map<string, TurnSummary[]>();
  for (const turn of turns) {
    // A turn still waiting for its conversation id has no session yet.
    if (turn.conversation === undefined && turn.state === 'running') continue;
    const key = turn.conversation === undefined ? '' : `c:${turn.conversation}`;
    groups.set(key, [...(groups.get(key) ?? []), turn]);
  }
  const sessions = [...groups.values()].map((group): ChatSession => {
    const ordered = group.toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
    const first = ordered[0] ?? group[0];
    const last = ordered[ordered.length - 1] ?? first;
    return {
      ...(first?.conversation === undefined ? {} : { id: first.conversation }),
      agent: first?.agent ?? 'agy',
      title: first?.prompt ?? '',
      turnCount: group.length,
      lastAt: last?.finishedAt ?? last?.startedAt ?? '',
    };
  });
  return sessions.toSorted((a, b) => b.lastAt.localeCompare(a.lastAt));
}
