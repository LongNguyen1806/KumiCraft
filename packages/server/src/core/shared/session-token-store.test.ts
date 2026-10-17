// The session token kept between runs (SPEC-05 S-05a).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, nodeFs, silentLogger } from '../workspace/test-support.ts';
import { loadSessionToken, SESSION_FILE, SESSION_TOKEN_MAX_AGE_MS } from './session-token-store.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

const at = (iso: string) => () => new Date(iso);

describe('loadSessionToken [S-05a]', () => {
  it('saves a new token and gives it back on the next run', async () => {
    const first = await loadSessionToken({ fs: nodeFs, dir, logger: silentLogger });
    const second = await loadSessionToken({ fs: nodeFs, dir, logger: silentLogger });

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toBe(first);
    expect(JSON.parse(await readFile(join(dir, SESSION_FILE), 'utf8'))).toMatchObject({
      token: first,
    });
  });

  it('replaces a token older than 7 days', async () => {
    const deps = { fs: nodeFs, dir, logger: silentLogger };
    const old = await loadSessionToken({ ...deps, now: at('2026-10-01T00:00:00.000Z') });
    const later = new Date(Date.parse('2026-10-01T00:00:00.000Z') + SESSION_TOKEN_MAX_AGE_MS);

    const fresh = await loadSessionToken({ ...deps, now: () => later });

    expect(fresh).not.toBe(old);
    expect(await loadSessionToken({ ...deps, now: () => later })).toBe(fresh);
  });

  it('replaces a broken or tampered file', async () => {
    await writeFile(
      join(dir, SESSION_FILE),
      '{"token":"short","createdAt":"2026-10-17T00:00:00Z"}',
    );

    const token = await loadSessionToken({ fs: nodeFs, dir, logger: silentLogger });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
