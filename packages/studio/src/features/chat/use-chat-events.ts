// Real-time server events listener for AI turns (WP-3.05a, WP-3.05b, R-CH-03); resyncs after a lost connection.
import {
  AgentEventMessageSchema,
  type JobStatus,
  type StudioServerEvent,
  TurnSummarySchema,
} from '@reactcraft/shared';
import { useEffect } from 'react';

import { createEventsClient } from '../../api/events-client.ts';
import { isRecord } from '../../api/http.ts';
import { fetchJob } from '../../api/jobs-client.ts';
import { useChatStore } from './chat-store.ts';

function handleAgentEvent(payload: unknown): void {
  const parsed = AgentEventMessageSchema.safeParse(payload);
  if (!parsed.success) return;
  useChatStore.getState().applyAgentEvent(parsed.data.turnId, parsed.data.event);
}

function handleJobCompleted(payload: unknown): void {
  if (!isRecord(payload) || typeof payload['jobId'] !== 'string') return;
  if (payload['kind'] !== 'agent.turn') return;
  const jobId = payload['jobId'];
  const summaryParsed = TurnSummarySchema.safeParse(payload['result']);
  const summary = summaryParsed.success ? summaryParsed.data : undefined;
  useChatStore.getState().finishJobCompleted(jobId, summary);
}

function handleJobFailed(payload: unknown): void {
  if (!isRecord(payload) || typeof payload['jobId'] !== 'string') return;
  const jobId = payload['jobId'];
  const err = payload['error'];
  if (!isRecord(err) || typeof err['code'] !== 'string') return;
  const code = err['code'];
  const params = isRecord(err['params']) ? err['params'] : undefined;
  const details = err['details'];
  useChatStore.getState().finishJobFailed(jobId, { code, params, details });
}

function handleJobCancelled(payload: unknown): void {
  if (!isRecord(payload) || typeof payload['jobId'] !== 'string') return;
  const jobId = payload['jobId'];
  useChatStore.getState().finishJobCancelled(jobId);
}

function dispatchServerEvent(event: StudioServerEvent): void {
  if (event.type === 'agent.event') {
    handleAgentEvent(event.payload);
  } else if (event.type === 'job.completed') {
    handleJobCompleted(event.payload);
  } else if (event.type === 'job.failed') {
    handleJobFailed(event.payload);
  } else if (event.type === 'job.cancelled') {
    handleJobCancelled(event.payload);
  }
}

function applyJobStatus(status: JobStatus): void {
  const store = useChatStore.getState();
  if (status.state === 'completed') {
    const summary = TurnSummarySchema.safeParse(status.result);
    store.finishJobCompleted(status.id, summary.success ? summary.data : undefined);
  } else if (status.state === 'failed' && status.error !== undefined) {
    store.finishJobFailed(status.id, status.error);
  } else if (status.state === 'cancelled') {
    store.finishJobCancelled(status.id);
  }
}

/**
 * After the event stream comes back, asks for each running turn's job: its end may have been
 * missed, or a restarted server no longer knows the job and the turn will never end on its own.
 */
async function resyncRunningTurns(): Promise<void> {
  const running = useChatStore
    .getState()
    .turns.filter((turn) => turn.state === 'running' && turn.jobId !== '');
  for (const turn of running) {
    try {
      applyJobStatus(await fetchJob(turn.jobId));
    } catch {
      useChatStore.getState().finishJobFailed(turn.jobId, { code: 'E027' });
    }
  }
}

export function useChatEvents(): void {
  useEffect(() => {
    let lostConnection = false;
    const client = createEventsClient({
      onEvent: (event) => {
        dispatchServerEvent(event);
      },
      onConnectionChange: (connected) => {
        if (!connected) {
          lostConnection = true;
          return;
        }
        if (lostConnection) {
          lostConnection = false;
          void resyncRunningTurns();
        }
      },
    });
    return () => {
      client.close();
    };
  }, []);
}
