import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { WORKSPACE_FILE } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readWorkspaceFile } from './read-workspace.ts';
import { makeTempDir, nodeFs } from './test-support.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  await mkdir(join(dir, '.kumicraft'), { recursive: true });
});

afterEach(async () => {
  await cleanup();
});

describe('readWorkspaceFile [V-106]', () => {
  it('refuses a workspace.json over 1 MB or nested deeper than 64 [V-106]', async () => {
    const wsPath = join(dir, WORKSPACE_FILE);

    await writeFile(wsPath, '['.repeat(70) + ']'.repeat(70));
    const deepResult = await readWorkspaceFile(nodeFs, dir);
    expect(deepResult).toEqual({
      ok: false,
      error: {
        code: 'E003',
        params: { file: '.kumicraft/workspace.json', reason: 'invalid' },
        details: [{ path: '.kumicraft/workspace.json', message: 'JSON nested too deeply (S-29)' }],
      },
    });

    await writeFile(wsPath, ' '.repeat(1024 * 1024 + 1));
    const largeResult = await readWorkspaceFile(nodeFs, dir);
    expect(largeResult).toEqual({
      ok: false,
      error: {
        code: 'E003',
        params: { file: '.kumicraft/workspace.json', reason: 'tooLarge' },
      },
    });
  });
});
