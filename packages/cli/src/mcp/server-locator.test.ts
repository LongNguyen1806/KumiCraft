// Finding the running ReactCraft server for `reactcraft mcp` (R-AG-19).
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { locateServer } from './server-locator.ts';

const WS = resolve('/ws');
const CONFIG = resolve('/config');
const NOW = new Date('2026-10-23T10:00:00.000Z');
const TOKEN = 'a'.repeat(43);
const LOCK = JSON.stringify({ pid: 1, hostname: 'h', startedAt: NOW.toISOString(), port: 4310 });
const SESSION = JSON.stringify({ token: TOKEN, createdAt: '2026-10-22T10:00:00.000Z' });

function files(entries: Readonly<Record<string, string>>) {
  return (path: string) => Promise.resolve(entries[path]);
}

const lockPath = join(WS, '.reactcraft', 'lock');
const sessionPath = join(CONFIG, 'session.json');

describe('locateServer [R-AG-19]', () => {
  it('reads the port from the lock and the token from the session file [R-AG-19]', async () => {
    const found = await locateServer(
      { projectDir: WS, port: undefined },
      {
        configDir: CONFIG,
        now: () => NOW,
        readText: files({ [lockPath]: LOCK, [sessionPath]: SESSION }),
      },
    );

    expect(found).toEqual({ port: 4310, token: TOKEN });
  });

  it('finds nothing without a lock, without a token, or with an old token [R-AG-19]', async () => {
    const deps = { configDir: CONFIG, now: () => NOW };
    const noLock = await locateServer(
      { projectDir: WS, port: undefined },
      { ...deps, readText: files({ [sessionPath]: SESSION }) },
    );
    const noToken = await locateServer(
      { projectDir: WS, port: undefined },
      { ...deps, readText: files({ [lockPath]: LOCK }) },
    );
    const oldSession = JSON.stringify({ token: TOKEN, createdAt: '2026-09-01T00:00:00.000Z' });
    const oldToken = await locateServer(
      { projectDir: WS, port: undefined },
      { ...deps, readText: files({ [lockPath]: LOCK, [sessionPath]: oldSession }) },
    );

    expect([noLock, noToken, oldToken]).toEqual([undefined, undefined, undefined]);
  });

  it('uses --port over the lock [R-AG-19]', async () => {
    const found = await locateServer(
      { projectDir: WS, port: 5000 },
      { configDir: CONFIG, now: () => NOW, readText: files({ [sessionPath]: SESSION }) },
    );

    expect(found).toEqual({ port: 5000, token: TOKEN });
  });
});
