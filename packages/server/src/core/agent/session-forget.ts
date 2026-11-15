// Opening an earlier chat session again (K9.5), and removing one from KumiCraft (owner, 2026-11-15): KumiCraft keeps its own record of
// each turn, so deleting the session in the agent (Antigravity, Claude) leaves it in the list.
// Only KumiCraft's record goes: the agent's own session files are never touched.
import type { CurrentConversation, ForgetConversationResult } from '@kumicraft/shared';

import { err, ok, type Result } from '../shared/result.ts';
import type { TurnSnapshotStore } from './snapshot/snapshot-types.ts';
import type { TurnStore } from './turn-store.ts';

export type ForgetDeps = {
  readonly store: TurnStore;
  readonly snapshots: Pick<TurnSnapshotStore, 'forget'>;
};

/** `conversationId` absent: the older turns saved without a session. */
export async function forgetConversation(
  deps: ForgetDeps,
  projectId: string,
  conversationId: string | undefined,
): Promise<Result<ForgetConversationResult>> {
  const turns = await deps.store.list(projectId);
  const inSession = turns.filter((t) => t.conversation === conversationId);
  if (inSession.length === 0) {
    return err({ code: 'E015', params: { resource: 'conversation', id: conversationId ?? '' } });
  }
  if (inSession.some((t) => t.state === 'running')) return err({ code: 'E018' });
  const ids = inSession.map((t) => t.id);
  const removed = await deps.store.remove(projectId, ids);
  if (!removed.ok) return removed;
  await deps.snapshots.forget(projectId, ids);
  const current = await deps.store.conversation(projectId);
  if (conversationId !== undefined && current?.id === conversationId) {
    await deps.store.setConversation(projectId, undefined);
  }
  return ok({ removed: ids.length });
}

/** The same for the open project. */
export async function forgetInProject(
  deps: ForgetDeps & { readonly project: () => Result<{ readonly id: string }> },
  conversationId: string | undefined,
): Promise<Result<ForgetConversationResult>> {
  const pRes = deps.project();
  return pRes.ok ? forgetConversation(deps, pRes.value.id, conversationId) : pRes;
}

/** Makes an earlier conversation the one "continue" resumes: only one KumiCraft ran here. */
export async function resumeInProject(
  deps: { readonly store: TurnStore; readonly project: () => Result<{ readonly id: string }> },
  conversationId: string,
): Promise<Result<CurrentConversation>> {
  const pRes = deps.project();
  if (!pRes.ok) return pRes;
  const turns = await deps.store.list(pRes.value.id);
  const owner = turns.find((t) => t.conversation === conversationId);
  if (owner === undefined) {
    return err({ code: 'E015', params: { resource: 'conversation', id: conversationId } });
  }
  const value = { agent: owner.agent, id: conversationId };
  const saved = await deps.store.setConversation(pRes.value.id, value);
  return saved.ok ? ok(value) : saved;
}
