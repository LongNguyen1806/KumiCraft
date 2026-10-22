// Polls agent login state every 3 seconds up to 10 minutes (R-AG-21).
import { useEffect, useRef } from 'react';

import { useAgentsStore } from '../../store/agents-store.ts';

export const LOGIN_POLL_INTERVAL_MS = 3000;
export const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

async function checkLoginAndReschedule(
  refresh: () => Promise<void>,
  isCancelled: () => boolean,
  onContinue: () => void,
): Promise<void> {
  if (isCancelled()) return;
  await refresh();
  if (isCancelled()) return;
  const current = useAgentsStore.getState().loginFlow;
  if (current?.phase === 'waiting' && !current.manual) {
    onContinue();
  }
}

export function useLoginWatcher(): void {
  const loginFlow = useAgentsStore((s) => s.loginFlow);
  const refresh = useAgentsStore((s) => s.refresh);
  const setLoginPhase = useAgentsStore((s) => s.setLoginPhase);

  const phase = loginFlow?.phase;
  const manual = loginFlow?.manual ?? false;
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (phase !== 'waiting' || manual) {
      if (timerRef.current !== undefined) clearTimeout(timerRef.current);
      return undefined;
    }

    const startedAt = Date.now();
    cancelledRef.current = false;

    const scheduleNext = () => {
      if (cancelledRef.current) return;
      if (Date.now() - startedAt >= LOGIN_TIMEOUT_MS) {
        setLoginPhase('timedOut');
        return;
      }
      timerRef.current = setTimeout(() => {
        void checkLoginAndReschedule(refresh, () => cancelledRef.current, scheduleNext);
      }, LOGIN_POLL_INTERVAL_MS);
    };

    scheduleNext();

    return () => {
      cancelledRef.current = true;
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [phase, manual, refresh, setLoginPhase]);
}
