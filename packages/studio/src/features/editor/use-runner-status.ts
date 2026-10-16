// Hook for dev server runner status and WebSocket logs (SPEC-04 M-RN, R-PJ-24).
import { type RunnerStatus, RunnerStatusSchema } from '@reactcraft/shared';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

import {
  createEventsClient,
  type EventsClient,
  type StudioServerEvent,
} from '../../api/events-client.ts';
import { fetchRunnerStatus, restartRunner, startRunner } from '../../api/runner-client.ts';

type RunnerStore = {
  readonly status: RunnerStatus;
  readonly logTail: string[];
  readonly setStatus: (status: RunnerStatus) => void;
  readonly appendLogLines: (lines: readonly string[]) => void;
};

const useRunnerStore = create<RunnerStore>((set) => ({
  status: { state: 'stopped' },
  logTail: [],
  setStatus: (status) => {
    set({ status });
  },
  appendLogLines: (lines) => {
    set((prev) => ({
      logTail: [...prev.logTail, ...lines].slice(-20),
    }));
  },
}));

let subscriberCount = 0;
let eventsClient: EventsClient | undefined;

function startSubscription(): void {
  subscriberCount += 1;
  if (subscriberCount === 1) {
    void (async () => {
      try {
        const s = await fetchRunnerStatus();
        useRunnerStore.getState().setStatus(s);
      } catch {
        // Ignored
      }
    })();

    eventsClient = createEventsClient({
      onEvent: (event: StudioServerEvent) => {
        if (event.type === 'runner.status') {
          const parsed = RunnerStatusSchema.safeParse(event.payload);
          if (parsed.success) {
            useRunnerStore.getState().setStatus(parsed.data);
          }
        } else if (event.type === 'runner.log') {
          if (
            event.payload &&
            typeof event.payload === 'object' &&
            'lines' in event.payload &&
            Array.isArray(event.payload.lines)
          ) {
            const lines = event.payload.lines.filter((l): l is string => typeof l === 'string');
            useRunnerStore.getState().appendLogLines(lines);
          }
        }
      },
    });
  }
}

function stopSubscription(): void {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount === 0 && eventsClient !== undefined) {
    eventsClient.close();
    eventsClient = undefined;
  }
}

export function useRunnerStatus() {
  const status = useRunnerStore((s) => s.status);
  const logTail = useRunnerStore((s) => s.logTail);

  useEffect(() => {
    startSubscription();
    return () => {
      stopSubscription();
    };
  }, []);

  const start = useCallback(() => {
    void (async () => {
      try {
        const res = await startRunner();
        useRunnerStore.getState().setStatus(res);
      } catch {
        // Handled via runner.status
      }
    })();
  }, []);

  const restart = useCallback(() => {
    void (async () => {
      try {
        const res = await restartRunner();
        useRunnerStore.getState().setStatus(res);
      } catch {
        // Handled via runner.status
      }
    })();
  }, []);

  return { status, logTail, start, restart };
}
