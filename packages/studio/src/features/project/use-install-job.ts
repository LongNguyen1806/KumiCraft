// Runs `install` as a job and follows it over WebSocket (R-PJ-13, R-PJ-22, SPEC-03 section 4.2).
import {
  JobCancelledEventSchema,
  JobCompletedEventSchema,
  type JobFailedEvent,
  JobFailedEventSchema,
  JobProgressEventSchema,
  type JobStatus,
  MAX_JOB_LINES,
} from '@reactcraft/shared';
import { useEffect, useRef, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { cancelJob, fetchJob } from '../../api/jobs-client.ts';
import { installProject } from '../../api/project-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';

export type InstallPhase = 'idle' | 'starting' | 'running' | 'cancelled';

export type InstallFailure = ErrorInfo & { readonly details: readonly string[] };

/** The error of a failed job, as the server sends it. */
type JobError = JobFailedEvent['error'];

type JobHandlers = {
  readonly onLines: (lines: readonly string[]) => void;
  readonly onCompleted: () => void;
  readonly onFailed: (error: JobError) => void;
  readonly onCancelled: () => void;
};

function failureOf(error: JobError): InstallFailure {
  return {
    code: error.code,
    params: error.params,
    details: (error.details ?? []).map((d) => d.message),
  };
}

/** Applies a `job.*` event of this job; events of other jobs are ignored. */
function applyEvent(event: StudioServerEvent, jobId: string, on: JobHandlers): void {
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
function applyStatus(status: JobStatus, on: JobHandlers): void {
  on.onLines(status.lines ?? []);
  if (status.state === 'completed') on.onCompleted();
  if (status.state === 'failed' && status.error !== undefined) on.onFailed(status.error);
  if (status.state === 'cancelled') on.onCancelled();
}

function useJobFollower(jobId: string | undefined, handlers: JobHandlers): void {
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
      // Events sent before this socket opened are read back from the job status.
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

export function useInstallJob(installCommand: readonly string[], onInstalled: () => void) {
  const [phase, setPhase] = useState<InstallPhase>('idle');
  const [jobId, setJobId] = useState<string>();
  const [lines, setLines] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<InstallFailure>();
  const finishedRef = useRef(false);

  const end = (next: InstallPhase) => {
    finishedRef.current = true;
    setJobId(undefined);
    setPhase(next);
  };

  useJobFollower(jobId, {
    onLines: (next) => {
      if (next.length > 0) setLines(next.slice(-MAX_JOB_LINES));
    },
    onCompleted: () => {
      if (finishedRef.current) return;
      end('idle');
      onInstalled();
    },
    onFailed: (error) => {
      if (finishedRef.current) return;
      end('idle');
      setFailure(failureOf(error));
    },
    onCancelled: () => {
      if (finishedRef.current) return;
      end('cancelled');
    },
  });

  const start = async () => {
    finishedRef.current = false;
    setPhase('starting');
    setLines([]);
    setFailure(undefined);
    try {
      const started = await installProject(installCommand);
      setJobId(started.jobId);
      setPhase('running');
    } catch (error) {
      setPhase('idle');
      setFailure({ ...toErrorInfo(error), details: [] });
    }
  };

  const cancel = () => {
    if (jobId !== undefined) void cancelJob(jobId);
  };

  return { phase, lines, failure, start, cancel };
}
