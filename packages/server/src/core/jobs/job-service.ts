// Long-running tasks with progress over WebSocket (SPEC-03 section 4.2, V-60 to V-62).
import { type JobKind, type JobStatus, MAX_JOB_LINES } from '@kumicraft/shared';
import { nanoid } from 'nanoid';

import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { type AppError, err, ok, type Result } from '../shared/result.ts';

/** V-61: a finished job stays readable this long. */
export const JOB_RETENTION_MS = 10 * 60 * 1000;
/** Output lines are sent at most this often (like `runner.log`). */
export const JOB_PROGRESS_MS = 200;

export type JobContext = {
  /** Aborted when the job is cancelled; the task stops its work (E019). */
  readonly signal: AbortSignal;
  reportLine(line: string): void;
};

export type JobRun = (ctx: JobContext) => Promise<Result<unknown>>;

export type JobService = {
  /** Starts a job; one job of a kind at a time (V-62, E018). */
  start(kind: JobKind, stepKey: string, run: JobRun): Result<{ readonly jobId: string }>;
  get(id: string): Result<JobStatus>;
  cancel(id: string): Result<void>;
  /** Cancels the running job of a kind, if any (R-PJ-12). */
  cancelKind(kind: JobKind): void;
  /** Cancels every running job on server shutdown (R-CL-02). */
  cancelAll(): void;
};

export type JobServiceDeps = {
  readonly system: Pick<SystemPort, 'now'>;
  readonly logger: LoggerPort;
  readonly eventBus?: EventBusPort | undefined;
  readonly newId?: () => string;
};

type JobRecord = {
  status: JobStatus;
  readonly stepKey: string;
  readonly controller: AbortController;
  lines: string[];
  progressTimer: ReturnType<typeof setTimeout> | undefined;
};

/** The error as the Studio sees it: `cause` stays on the server (QC-51). */
function publicError(error: AppError): NonNullable<JobStatus['error']> {
  return {
    code: error.code,
    ...(error.params === undefined ? {} : { params: error.params }),
    ...(error.details === undefined ? {} : { details: error.details }),
  };
}

type JobStore = {
  readonly deps: JobServiceDeps;
  readonly jobs: Map<string, JobRecord>;
};

const nowIso = (store: JobStore) => store.deps.system.now().toISOString();

/** V-61: forgets jobs that finished more than 10 minutes ago. */
function prune(store: JobStore): void {
  const limit = store.deps.system.now().getTime() - JOB_RETENTION_MS;
  for (const [id, job] of store.jobs) {
    const finished = job.status.finishedAt;
    if (finished !== undefined && Date.parse(finished) < limit) store.jobs.delete(id);
  }
}

function sendProgress(store: JobStore, id: string, job: JobRecord): void {
  job.progressTimer = undefined;
  store.deps.eventBus?.publish('job.progress', {
    jobId: id,
    kind: job.status.kind,
    done: 0,
    total: 0,
    stepKey: job.stepKey,
    lines: [...job.lines],
  });
}

function finish(store: JobStore, id: string, job: JobRecord, outcome: Result<unknown>): void {
  if (job.status.state !== 'running') return;
  if (job.progressTimer !== undefined) {
    clearTimeout(job.progressTimer);
    sendProgress(store, id, job);
  }
  const base = { ...job.status, lines: [...job.lines], finishedAt: nowIso(store) };
  const { kind } = job.status;
  const bus = store.deps.eventBus;
  if (job.controller.signal.aborted) {
    job.status = { ...base, state: 'cancelled', error: { code: 'E019', params: { jobId: id } } };
    bus?.publish('job.cancelled', { jobId: id, kind });
  } else if (outcome.ok) {
    job.status = { ...base, state: 'completed', result: outcome.value };
    bus?.publish('job.completed', { jobId: id, kind, result: outcome.value });
  } else {
    const error = publicError(outcome.error);
    // The log file is what a user sends back: the reason and the last output lines go there.
    store.deps.logger.warn(
      { jobId: id, kind, code: error.code, params: error.params, lastLines: job.lines.slice(-20) },
      'job failed',
    );
    job.status = { ...base, state: 'failed', error };
    bus?.publish('job.failed', { jobId: id, kind, error });
  }
}

function abortJob(store: JobStore, job: JobRecord): void {
  if (job.status.state !== 'running') return;
  job.controller.abort();
  finish(store, job.status.id, job, err({ code: 'E019', params: { jobId: job.status.id } }));
}

async function runJob(store: JobStore, id: string, job: JobRecord, run: JobRun): Promise<void> {
  const ctx: JobContext = {
    signal: job.controller.signal,
    reportLine: (line) => {
      job.lines = [...job.lines, line].slice(-MAX_JOB_LINES);
      job.progressTimer ??= setTimeout(() => {
        sendProgress(store, id, job);
      }, JOB_PROGRESS_MS);
    },
  };
  let outcome: Result<unknown>;
  try {
    outcome = await run(ctx);
  } catch (cause) {
    store.deps.logger.error({ err: cause, jobId: id }, 'job crashed');
    outcome = err({ code: 'E013', cause });
  }
  finish(store, id, job, outcome);
}

function runningJob(store: JobStore, kind: JobKind): JobRecord | undefined {
  return [...store.jobs.values()].find(
    (job) => job.status.kind === kind && job.status.state === 'running',
  );
}

function newJob(store: JobStore, id: string, kind: JobKind, stepKey: string): JobRecord {
  return {
    status: {
      id,
      kind,
      state: 'running',
      progress: { done: 0, total: 0, stepKey },
      startedAt: nowIso(store),
    },
    stepKey,
    controller: new AbortController(),
    lines: [],
    progressTimer: undefined,
  };
}

function findJob(store: JobStore, id: string): Result<JobRecord> {
  prune(store);
  const job = store.jobs.get(id);
  return job === undefined ? err({ code: 'E015', params: { resource: 'job', id } }) : ok(job);
}

export function createJobService(deps: JobServiceDeps): JobService {
  const store: JobStore = { deps, jobs: new Map() };
  const newId = deps.newId ?? (() => nanoid(12));

  return {
    start(kind, stepKey, run) {
      prune(store);
      if (runningJob(store, kind) !== undefined) {
        return err({ code: 'E018', params: { resource: kind } });
      }
      const id = newId();
      const job = newJob(store, id, kind, stepKey);
      store.jobs.set(id, job);
      void runJob(store, id, job, run);
      return ok({ jobId: id });
    },

    get(id) {
      const found = findJob(store, id);
      if (!found.ok) return found;
      return ok({ ...found.value.status, lines: [...found.value.lines] });
    },

    cancel(id) {
      const found = findJob(store, id);
      if (!found.ok) return found;
      abortJob(store, found.value);
      return ok(undefined);
    },

    cancelKind(kind) {
      const job = runningJob(store, kind);
      if (job !== undefined) abortJob(store, job);
    },

    cancelAll() {
      for (const job of store.jobs.values()) {
        abortJob(store, job);
      }
    },
  };
}
