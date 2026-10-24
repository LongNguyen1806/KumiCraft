// Follows a job over WebSocket with resync over HTTP (R-PJ-13, R-PJ-22, SPEC-03 section 4.2).
import {
  JobCancelledEventSchema,
  JobCompletedEventSchema,
  type JobFailedEvent,
  JobFailedEventSchema,
  JobProgressEventSchema,
  type JobStatus,
} from '@kumicraft/shared';
import { useEffect, useRef } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { fetchJob } from '../../api/jobs-client.ts';
import type { ErrorInfo } from '../../routes/error-text.ts';

export type JobFailure = ErrorInfo & { readonly details: readonly string[] };

/** The error of a failed job, as the server sends it. */
export type JobError = JobFailedEvent['error'];

export type JobHandlers = {
  readonly onLines: (lines: readonly string[]) => void;
  readonly onCompleted: () => void;
  readonly onFailed: (error: JobError) => void;
  readonly onCancelled: () => void;
};

export function failureOf(error: JobError): JobFailure {
  return {
    code: error.code,
    params: error.params,
    details: (error.details ?? []).map((d) => d.message),
  };
}

/** Applies a `job.*` event of this job; events of other jobs are ignored. */
export function applyEvent(event: StudioServerEvent, jobId: string, on: JobHandlers): void {
  const progress = JobProgressEventSchema.safeParse(event.payload);
  if (event.type === 'job.progress' && progress.success && progress.data.jobId === jobId) {
    on.onLines(progress.data.lines ?? []);
    return;
  }
  const completed = JobCompletedEventSchema.safeParse(event.payload);
  if (event.type === 'job.completed' && completed.success && completed.data.jobId === jobId) {
    on.onCompleted();
    return;
  }
  const failed = JobFailedEventSchema.safeParse(event.payload);
  if (event.type === 'job.failed' && failed.success && failed.data.jobId === jobId) {
    on.onFailed(failed.data.error);
    return;
  }
  const cancelled = JobCancelledEventSchema.safeParse(event.payload);
  if (event.type === 'job.cancelled' && cancelled.success && cancelled.data.jobId === jobId) {
    on.onCancelled();
  }
}

/** Applies a status read with GET /jobs/{id} (after the WebSocket connects again). */
export function applyStatus(status: JobStatus, on: JobHandlers): void {
  on.onLines(status.lines ?? []);
  if (status.state === 'completed') on.onCompleted();
  if (status.state === 'failed' && status.error !== undefined) on.onFailed(status.error);
  if (status.state === 'cancelled') on.onCancelled();
}

export function useJobFollower(jobId: string | undefined, handlers: JobHandlers): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (jobId === undefined) return undefined;
    const on: JobHandlers = {
      onLines: (lines) => {
        handlersRef.current.onLines(lines);
      },
      onCompleted: () => {
        handlersRef.current.onCompleted();
      },
      onFailed: (error) => {
        handlersRef.current.onFailed(error);
      },
      onCancelled: () => {
        handlersRef.current.onCancelled();
      },
    };
    const resync = async () => {
      try {
        applyStatus(await fetchJob(jobId), on);
      } catch {
        // The next event or the next connection brings the state.
      }
    };
    const client = createEventsClient({
      onConnectionChange: (connected) => {
        if (connected) void resync();
      },
      onEvent: (event) => {
        applyEvent(event, jobId, on);
      },
    });
    return () => {
      client.close();
    };
  }, [jobId]);
}
