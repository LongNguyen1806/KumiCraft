// History loader for agent turns (WP-3.05b, R-CH-05).
import { useEffect, useRef } from 'react';

import { fetchConversation, fetchTurns } from '../../api/agent-client.ts';
import { turnsOfSession } from './chat-sessions-model.ts';
import { useChatStore } from './chat-store.ts';

/** First load: the session the next turn continues, or the turns saved before sessions. */
async function openCurrentSession(active: () => boolean): Promise<void> {
  try {
    const [turns, current] = await Promise.all([fetchTurns(), fetchConversation()]);
    if (active()) {
      useChatStore.getState().showSession(turnsOfSession(turns, current.id), current.id);
    }
  } catch {
    // Ignore error so chat remains usable (WP-3.05b).
  }
}

async function reloadTurns(active: () => boolean): Promise<void> {
  try {
    const turns = await fetchTurns();
    if (active()) {
      useChatStore.getState().loadHistory(turns);
    }
  } catch {
    // Ignore error so chat remains usable (WP-3.05b).
  }
}

export function useChatHistory(enabled: boolean): void {
  const hasRunningTurn = useChatStore((s) => s.turns.some((t) => t.state === 'running'));
  const prevRunningRef = useRef(hasRunningTurn);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void openCurrentSession(() => active);
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    if (prevRunningRef.current && !hasRunningTurn) {
      void reloadTurns(() => active);
    }
    prevRunningRef.current = hasRunningTurn;
    return () => {
      active = false;
    };
  }, [enabled, hasRunningTurn]);
}
