import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { STACKS } from '../../stacks/index.ts';
import { makeTempDir, nodeFs, platform, writeSupportedProject } from '../workspace/test-support.ts';
import { probeProject } from './probe.ts';

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe('probeProject [R-PJ-01]', () => {
  it('tells missing, empty and project folders apart [R-PJ-01]', async () => {
    const missing = await probeProject(join(dir, 'nope'), { fs: nodeFs, platform, stacks: STACKS });
    expect(missing).toEqual({ ok: true, value: { kind: 'missing', canCreate: true } });

    await writeFile(join(dir, 'README.md'), '# test');
    const empty = await probeProject(dir, { fs: nodeFs, platform, stacks: STACKS });
    expect(empty).toEqual({ ok: true, value: { kind: 'empty' } });

    const projDir = join(dir, 'proj');
    await writeSupportedProject(projDir);
    const proj = await probeProject(projDir, { fs: nodeFs, platform, stacks: STACKS });
    expect(proj.ok).toBe(true);
    if (proj.ok) {
      expect(proj.value.kind).toBe('project');
    }
  });
});
