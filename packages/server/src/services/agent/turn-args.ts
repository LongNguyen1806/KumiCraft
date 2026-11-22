// Building a turn: the agent's arguments and the summary of a turn that just started.
import type { AgentRunChoice, StartTurnRequest, TurnNotice, TurnSummary } from '@kumicraft/shared';

import type { ResolvedAgent } from './turn-types.ts';

export function computeAdapterArgs(
  resolved: ResolvedAgent,
  prompt: string,
  mirrors: readonly { readonly dir: string }[],
  allowEdits: boolean,
  conversationId?: string,
  imageDir?: string,
  choice?: AgentRunChoice,
): readonly string[] {
  const mirrorDirs =
    imageDir !== undefined ? [...mirrors.map((m) => m.dir), imageDir] : mirrors.map((m) => m.dir);
  const adapterArgs = resolved.adapter.buildArgs({
    prompt,
    mirrorDirs,
    allowEdits,
    conversationId,
    model: choice?.model,
    effort: choice?.effort,
  });
  return [...resolved.command.prefixArgs, ...adapterArgs];
}

export function runningSummary(
  deps: { readonly now: () => Date },
  turnId: string,
  resolved: ResolvedAgent,
  request: StartTurnRequest,
  notices: TurnNotice[],
): TurnSummary {
  return {
    id: turnId,
    agent: resolved.status.id,
    startedAt: deps.now().toISOString(),
    prompt: request.prompt,
    state: 'running',
    files: [],
    revertible: false,
    notices,
  };
}
