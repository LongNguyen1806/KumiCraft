import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acquireLock, LOCK_FILE, releaseLock } from './lock.ts';
import { fakeSystem, makeTempDir, nodeFs } from './test-support.ts';

let dir: string;
let cleanup: () => Promise<void>;
const alive = new Set<number>();

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  alive.clear();
});

afterEach(async () => {
  await cleanup();
});

const lockText = () => readFile(join(dir, LOCK_FILE), 'utf8');

describe('acquireLock', () => {
  it('writes pid, hostname, start time and port', async () => {
    expect(await acquireLock(nodeFs, dir, fakeSystem(1, alive), 5420)).toEqual({
      ok: true,
      value: undefined,
    });

    expect(JSON.parse(await lockText())).toEqual({
      pid: 1,
      hostname: 'MY-PC',
      startedAt: '2026-10-11T08:09:10.123Z',
      port: 5420,
    });
  });

  it('refuses a second session while the first runs, giving its port', async () => {
    alive.add(1);
    await acquireLock(nodeFs, dir, fakeSystem(1, alive), 5420);

    expect(await acquireLock(nodeFs, dir, fakeSystem(2, alive), 5421)).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { resource: 'workspace', port: 5420, pid: 1 } },
    });
  });

  it('reclaims the lock of a dead process on the same machine', async () => {
    await acquireLock(nodeFs, dir, fakeSystem(1, alive), 5420);

    expect((await acquireLock(nodeFs, dir, fakeSystem(2, alive), 5421)).ok).toBe(true);
    expect(JSON.parse(await lockText())).toMatchObject({ pid: 2, port: 5421 });
  });

  it('never reclaims a lock from another machine (shared folder)', async () => {
    await acquireLock(nodeFs, dir, fakeSystem(1, alive, 'OTHER-PC'), 5420);

    expect((await acquireLock(nodeFs, dir, fakeSystem(2, alive), 5421)).ok).toBe(false);
  });

  it('treats an unreadable lock as held', async () => {
    await mkdir(join(dir, '.reactcraft'));
    await writeFile(join(dir, LOCK_FILE), 'garbage');

    expect(await acquireLock(nodeFs, dir, fakeSystem(2, alive), 5421)).toMatchObject({
      ok: false,
      error: { code: 'E018', params: { resource: 'workspace' } },
    });
  });
});

describe('releaseLock', () => {
  it('removes only a lock this process holds', async () => {
    await acquireLock(nodeFs, dir, fakeSystem(1, alive), 5420);

    await releaseLock(nodeFs, dir, fakeSystem(2, alive));
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(true);
    await releaseLock(nodeFs, dir, fakeSystem(1, alive));
    expect(await nodeFs.exists(dir, LOCK_FILE)).toBe(false);
  });
});
