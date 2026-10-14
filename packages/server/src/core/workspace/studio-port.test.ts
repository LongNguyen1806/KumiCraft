import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { newWorkspaceFile, serializeWorkspaceFile, WORKSPACE_FILE } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ok } from '../shared/result.ts';
import { readRememberedPort, rememberPort, STUDIO_CACHE_FILE } from './studio-port.ts';
import { fakeSystem, makeTempDir, nodeFs, silentLogger } from './test-support.ts';
import { createWorkspaceService } from './workspace-service.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('studio port', () => {
  it('remembers a dynamic port and reads it back [S-02]', async () => {
    await rememberPort(nodeFs, dir, 61462);

    expect(await readRememberedPort(nodeFs, dir)).toBe(61462);
  });

  it('ignores ports outside the dynamic range, a missing file and garbage', async () => {
    expect(await readRememberedPort(nodeFs, dir)).toBeUndefined();
    await rememberPort(nodeFs, dir, 8080);
    expect(await nodeFs.exists(dir, STUDIO_CACHE_FILE)).toBe(false);

    for (const text of ['{ "port": 80 }', '{ "port": "61462" }', 'not json']) {
      await nodeFs.writeTextAtomic(dir, STUDIO_CACHE_FILE, text);
      expect(await readRememberedPort(nodeFs, dir)).toBeUndefined();
    }
  });

  it('is written when the workspace service takes the lock', async () => {
    await mkdir(join(dir, '.reactcraft'));
    const file = newWorkspaceFile({
      id: 'shop000001',
      name: 'Shop',
      createdAt: '2026-10-14T08:00:00.000Z',
      responsiveMode: 'desktop-first',
    });
    await writeFile(join(dir, WORKSPACE_FILE), serializeWorkspaceFile(file));
    const service = createWorkspaceService({
      fs: nodeFs,
      root: dir,
      system: fakeSystem(1, new Set([1])),
      config: { isTrusted: () => false, setTrusted: () => Promise.resolve(ok(undefined)) },
      logger: silentLogger,
      port: 50123,
    });

    await service.open();
    await service.close();

    expect(await readRememberedPort(nodeFs, dir)).toBe(50123);
  });
});
