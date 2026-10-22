// Real-time server events listener for AI turns (WP-3.05a, WP-3.05b, R-CH-03).
import {
  AgentEventMessageSchema,
  type StudioServerEvent,
  TurnSummarySchema,
} from '@reactcraft/shared';
import { useEffect } from 'react';

import { createEventsClient } from '../../api/events-client.ts';
import { isRecord } from '../../api/http.ts';
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

export function useChatEvents(): void {
  useEffect(() => {
    const client = createEventsClient({
      onEvent: (event) => {
        dispatchServerEvent(event);
      },
    });
    return () => {
      client.close();
    };
  }, []);
}
