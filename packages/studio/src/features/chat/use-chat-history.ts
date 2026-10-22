// History loader for agent turns (WP-3.05b, R-CH-05).
import { useEffect, useRef } from 'react';

import { fetchTurns } from '../../api/agent-client.ts';
import { useChatStore } from './chat-store.ts';

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
    void reloadTurns(() => active);
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
