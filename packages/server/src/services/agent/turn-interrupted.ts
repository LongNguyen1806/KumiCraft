// Turns a stopped server left "running" (R-AG-16): nothing will ever finish them, so they would
// keep the chat busy for good. Any running turn this server is not running becomes failed.
import type { TurnSummary } from '@kumicraft/shared';

import type { TurnStore } from './turn-store.ts';

export async function settleInterruptedTurns(
  store: TurnStore,
  projectId: string,
  summaries: readonly TurnSummary[],
  activeTurnIds: ReadonlySet<string>,
  now: () => Date,
): Promise<readonly TurnSummary[]> {
  const settled: TurnSummary[] = [];
  for (const summary of summaries) {
    if (summary.state !== 'running' || activeTurnIds.has(summary.id)) {
      settled.push(summary);
      continue;
    }
    const failed: TurnSummary = { ...summary, state: 'failed', finishedAt: now().toISOString() };
    await store.save(projectId, failed);
    settled.push(failed);
  }
  return settled;
}
