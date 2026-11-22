import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ok } from '../../kernel/result.ts';
import { STACKS } from '../../stacks/index.ts';
import { createProjectService } from '../project/project-service.ts';
import { readRememberedPort, rememberPort, STUDIO_CACHE_FILE } from './studio-port.ts';
import {
  fakeSystem,
  makeTempDir,
  nodeFs,
  platform,
  silentLogger,
  writeSupportedProject,
} from './test-support.ts';

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

  it('is written when the project service takes the lock [S-02]', async () => {
    await writeSupportedProject(dir);
    const service = createProjectService({
      stacks: STACKS,
      fs: nodeFs,
      system: fakeSystem(1, new Set([1])),
      process: {
        spawn: () => {
          throw new Error('no process in this test');
        },
      },
      config: {
        isTrusted: () => false,
        setTrusted: () => Promise.resolve(ok(undefined)),
        settings: () => ({ editor: 'vscode', agent: { preferred: 'auto' } }),
      },
      logger: silentLogger,
      port: 50123,
      platform,
      templateDir: dir,
    });

    await service.open(dir);
    await service.close();

    expect(await readRememberedPort(nodeFs, dir)).toBe(50123);
  });
});
