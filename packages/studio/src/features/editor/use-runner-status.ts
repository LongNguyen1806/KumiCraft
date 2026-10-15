// Hook for dev server runner status and WebSocket logs (SPEC-04 M-RN).
import type { RunnerStatus } from '@reactcraft/shared';
import { useCallback, useEffect, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { fetchRunnerStatus, restartRunner, startRunner } from '../../api/runner-client.ts';

export function useRunnerStatus() {
  const [status, setStatus] = useState<RunnerStatus>({ state: 'stopped' });
  const [logTail, setLogTail] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const s = await fetchRunnerStatus();
        if (!cancelled) setStatus(s);
      } catch {
        // Ignored
      }
    };
    void fetchStatus();

    const client = createEventsClient({
      onEvent: (event: StudioServerEvent) => {
        if (event.type === 'runner.status') {
          setStatus(event.payload as RunnerStatus);
        } else if (event.type === 'runner.log') {
          const logData = event.payload as { lines: string[] };
          if (Array.isArray(logData.lines)) {
            setLogTail((prev) => [...prev, ...logData.lines].slice(-20));
          }
        }
      },
    });

    return () => {
      cancelled = true;
      client.close();
    };
  }, []);

  const start = useCallback(() => {
    void (async () => {
      try {
        const res = await startRunner();
        setStatus(res);
      } catch {
        // Handled via runner.status
      }
    })();
  }, []);

  const restart = useCallback(() => {
    void (async () => {
      try {
        const res = await restartRunner();
        setStatus(res);
      } catch {
        // Handled via runner.status
      }
    })();
  }, []);

  return { status, logTail, start, restart };
}
