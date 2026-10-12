import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acquireLock, LOCK_FILE, type LockTiming, releaseLock } from './lock.ts';
import { fakeSystem, makeTempDir, nodeFs, NOW } from './test-support.ts';

let dir: string;
let cleanup: () => Promise<void>;
const alive = new Set<number>();
const listening = new Set<number>();
const FAST: LockTiming = { startupGraceMs: 15_000, settleMs: 0 };
/** One minute after NOW: past the startup grace of a lock written at NOW. */
const later = () => new Date(NOW.getTime() + 60_000);

/** Process `pid` of MY-PC; `clock` defaults to NOW. */
const system = (pid: number, clock: () => Date = () => NOW, host = 'MY-PC') =>
  fakeSystem(pid, alive, host, listening, clock);

const take = (pid: number, port: number, clock?: () => Date, host?: string) =>
  acquireLock(nodeFs, dir, system(pid, clock, host), port, FAST);

const writeLock = async (text: string) => {
  await mkdir(join(dir, '.reactcraft'), { recursive: true });
  await writeFile(join(dir, LOCK_FILE), text);
};

const lockOnDisk = async () => JSON.parse(await readFile(join(dir, LOCK_FILE), 'utf8')) as object;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  alive.clear();
  listening.clear();
});

afterEach(async () => {
  await cleanup();
});

describe('acquireLock', () => {
  it('writes pid, hostname, start time and port', async () => {
    expect(await take(1, 5420)).toMatchObject({ ok: true });

    expect(await lockOnDisk()).toEqual({
      pid: 1,
      hostname: 'MY-PC',
      startedAt: '2026-10-11T08:09:10.123Z',
      port: 5420,
    });
  });

  it('refuses a second session while the first runs, giving its port [E018]', async () => {
    await take(1, 5420);
    alive.add(1);
    listening.add(5420);

    expect(await take(2, 5421, later)).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { resource: 'workspace', port: 5420, pid: 1 } },
    });
  });

  it('respects a session that is still starting and not listening yet [R-WS-03]', async () => {
    await take(1, 5420);
    alive.add(1);

    expect(await take(2, 5421)).toMatchObject({ ok: false, error: { code: 'E018' } });
  });

  it('reclaims the lock of a process that is gone', async () => {
    await take(1, 5420);

    expect((await take(2, 5421)).ok).toBe(true);
    expect(await lockOnDisk()).toMatchObject({ pid: 2, port: 5421 });
  });

  it('reclaims the lock after a restart when its pid now belongs to another program [R-WS-03]', async () => {
    // Before the restart: ReactCraft ran as pid 1 on port 5420, then the power went off.
    await take(1, 5420);
    // After the restart: another program got pid 1, nothing listens on 5420.
    alive.add(1);

    expect((await take(7, 5430, later)).ok).toBe(true);
    expect(await lockOnDisk()).toMatchObject({ pid: 7, port: 5430 });
  });

  it('never reclaims a lock from another machine (shared folder) [R-WS-04]', async () => {
    await take(1, 5420, later, 'OTHER-PC');

    expect(await take(2, 5421, later)).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { hostname: 'OTHER-PC' } },
    });
  });

  it('reclaims an empty or broken lock left by a power cut', async () => {
    for (const text of ['', '{ "pid": 1', '{"pid":"x"}']) {
      await writeLock(text);

      expect((await take(2, 5421)).ok).toBe(true);
      await nodeFs.remove(dir, LOCK_FILE);
    }
  });

  it('waits for a lock being written before judging it', async () => {
    await writeLock('');
    alive.add(1);
    listening.add(5420);
    const timing: LockTiming = { startupGraceMs: 15_000, settleMs: 50 };
    setTimeout(() => {
      void writeLock(JSON.stringify({ pid: 1, hostname: 'MY-PC', startedAt: NOW, port: 5420 }));
    }, 5);

    const result = await acquireLock(nodeFs, dir, system(2, later), 5421, timing);

    expect(result).toMatchObject({ ok: false, error: { code: 'E018', params: { port: 5420 } } });
  });
});

describe('releaseLock', () => {
  it('removes only the lock this server wrote', async () => {
    const first = await take(1, 5420);
    if (!first.ok) throw new Error(first.error.code);
    await nodeFs.remove(dir, LOCK_FILE);
    const second = await take(1, 5430, later);
    if (!second.ok) throw new Error(second.error.code);

    await releaseLock(nodeFs, dir, first.value);
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(true);
    await releaseLock(nodeFs, dir, second.value);
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);
  });

  it('does nothing when the lock is already gone', async () => {
    const taken = await take(1, 5420);
    if (!taken.ok) throw new Error(taken.error.code);
    await nodeFs.remove(dir, LOCK_FILE);

    await releaseLock(nodeFs, dir, taken.value);

    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);
  });
});
