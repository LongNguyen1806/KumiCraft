// Reading types runs the project's own TypeScript in a child process: only for a trusted project
// (S-80, QA K9.7-4). An untrusted project is read from its source text alone.
import { describe, expect, it } from 'vitest';

import { nodeFs } from '../../../services/workspace/test-support.ts';
import { readerDeps } from './project-data.ts';

const spawned: string[] = [];
const deps = {
  fs: nodeFs,
  process: {
    spawn: (command: string) => {
      spawned.push(command);
      throw new Error('must not run');
    },
  },
  tsInspectScript: '/runners/ts-inspect.mjs',
};

describe('readerDeps [S-80, K9.7-4 QA]', () => {
  it('gives the TypeScript child process only to a trusted project', () => {
    const untrusted = readerDeps(nodeFs, deps, false);
    expect(untrusted.process).toBeUndefined();
    expect(untrusted.tsInspectScript).toBeUndefined();

    const trusted = readerDeps(nodeFs, deps, true);
    expect(trusted.process).toBe(deps.process);
    expect(trusted.tsInspectScript).toBe('/runners/ts-inspect.mjs');
    expect(spawned).toEqual([]);
  });
});
