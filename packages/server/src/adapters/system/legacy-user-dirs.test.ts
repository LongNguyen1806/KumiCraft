// User folders of the old app name move to the new one (R-PJ-26).
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { makeTempDir, silentLogger } from '../../core/workspace/test-support.ts';
import { moveLegacyUserDirs } from './legacy-user-dirs.ts';

describe('moveLegacyUserDirs [R-PJ-26]', () => {
  let dir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ dir, cleanup } = await makeTempDir());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('moves the old config folder, so the recent projects survive the rename', async () => {
    const from = join(dir, 'reactcraft', 'Config');
    const to = join(dir, 'kumicraft', 'Config');
    await mkdir(from, { recursive: true });
    await writeFile(join(from, 'config.json'), '{"recentProjects":[]}');

    await moveLegacyUserDirs([{ from, to }], silentLogger);

    expect(await readFile(join(to, 'config.json'), 'utf8')).toBe('{"recentProjects":[]}');
    expect(existsSync(from)).toBe(false);
  });

  it('never overwrites a folder that already exists under the new name', async () => {
    const from = join(dir, 'old');
    const to = join(dir, 'new');
    await mkdir(from, { recursive: true });
    await mkdir(to, { recursive: true });
    await writeFile(join(to, 'config.json'), 'new');

    await moveLegacyUserDirs([{ from, to }], silentLogger);

    expect(await readFile(join(to, 'config.json'), 'utf8')).toBe('new');
    expect(existsSync(from)).toBe(true);
  });
});
