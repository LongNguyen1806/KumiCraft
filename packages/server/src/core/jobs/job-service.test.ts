// Tests for the job service (SPEC-03 section 4.2, V-61, V-62).
import { err, ok } from '@reactcraft/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEventBus, type ServerEvent } from '../ports/event-bus-port.ts';
import { silentLogger } from '../workspace/test-support.ts';
import { createJobService, JOB_PROGRESS_MS, JOB_RETENTION_MS } from './job-service.ts';

function setup() {
  let now = new Date('2026-10-16T08:00:00.000Z').getTime();
  const bus = createEventBus();
  const events: ServerEvent[] = [];
  bus.subscribe((event) => events.push(event));
  let next = 0;
  const jobs = createJobService({
    system: { now: () => new Date(now) },
    logger: silentLogger,
    eventBus: bus,
    newId: () => `job${String((next += 1))}`,
  });
  return {
    jobs,
    events,
    advanceClock: (ms: number) => {
      now += ms;
    },
    ofType: (type: string) => events.filter((e) => e.type === type),
  };
}

/** A task that waits until the test lets it finish. */
function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('job service', () => {
  it('sends the newest 20 output lines, then completed [R-PJ-13, V-60]', async () => {
    vi.useFakeTimers();
    const t = setup();
    const done = gate();
    const started = t.jobs.start('project.install', 'jobs:install.running', async (ctx) => {
      for (let i = 1; i <= 25; i += 1) ctx.reportLine(`line ${String(i)}`);
      await done.opened;
      return ok('installed');
    });
    expect(started).toEqual({ ok: true, value: { jobId: 'job1' } });

    await vi.advanceTimersByTimeAsync(JOB_PROGRESS_MS);
    const progress = t.ofType('job.progress');
    expect(progress).toHaveLength(1);
    expect(progress[0]?.payload).toMatchObject({
      jobId: 'job1',
      kind: 'project.install',
      stepKey: 'jobs:install.running',
    });
    const lines = (progress[0]?.payload as { readonly lines: readonly string[] }).lines;
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('line 6');
    expect(lines[19]).toBe('line 25');

    done.open();
    await vi.waitFor(() => {
      expect(t.ofType('job.completed')).toHaveLength(1);
    });
    expect(t.jobs.get('job1')).toMatchObject({ ok: true, value: { state: 'completed' } });
  });

  it('reports a failed task with its error, without the server-side cause [R-PJ-13]', async () => {
    const t = setup();
    t.jobs.start('project.install', 'jobs:install.running', () =>
      Promise.resolve(err({ code: 'E028', details: [{ message: 'ERR_PNPM' }], cause: 'secret' })),
    );

    await vi.waitFor(() => {
      expect(t.ofType('job.failed')).toHaveLength(1);
    });
    expect(t.ofType('job.failed')[0]?.payload).toEqual({
      jobId: 'job1',
      kind: 'project.install',
      error: { code: 'E028', details: [{ message: 'ERR_PNPM' }] },
    });
  });

  it('cancels a running task through its signal [R-PJ-13]', async () => {
    const t = setup();
    t.jobs.start('project.install', 'jobs:install.running', async (ctx) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => {
          resolve();
        });
      });
      return err({ code: 'E028' });
    });

    expect(t.jobs.cancel('job1').ok).toBe(true);

    await vi.waitFor(() => {
      expect(t.ofType('job.cancelled')).toHaveLength(1);
    });
    expect(t.ofType('job.failed')).toHaveLength(0);
    expect(t.jobs.get('job1')).toMatchObject({
      ok: true,
      value: { state: 'cancelled', error: { code: 'E019' } },
    });
  });

  it('refuses a second job of the same kind while one runs [V-62]', () => {
    const t = setup();
    const done = gate();
    t.jobs.start('project.install', 'jobs:install.running', async () => {
      await done.opened;
      return ok(undefined);
    });

    const second = t.jobs.start('project.install', 'jobs:install.running', () =>
      Promise.resolve(ok(undefined)),
    );

    expect(second).toMatchObject({ ok: false, error: { code: 'E018' } });
    done.open();
  });

  it('forgets a finished job after 10 minutes [V-61]', async () => {
    const t = setup();
    t.jobs.start('project.install', 'jobs:install.running', () => Promise.resolve(ok(undefined)));
    await vi.waitFor(() => {
      expect(t.ofType('job.completed')).toHaveLength(1);
    });

    t.advanceClock(JOB_RETENTION_MS);
    expect(t.jobs.get('job1').ok).toBe(true);
    t.advanceClock(1);
    expect(t.jobs.get('job1')).toMatchObject({ ok: false, error: { code: 'E015' } });
  });
});
