// Test AI turn execution when agent is loggedOut (WP-3.06b, R-AG-21).
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import { createJobService } from '../jobs/job-service.ts';
import { createMirrorService } from '../mirror/mirror-service.ts';
import { createEventBus } from '../ports/event-bus-port.ts';
import type { ChildProcessHandle, ProcessPort } from '../ports/process-port.ts';
import { ok } from '../shared/result.ts';
import { toSupportedPlatform } from '../shared/session.ts';
import { silentLogger } from '../workspace/test-support.ts';
import { agyAdapter } from './adapters/agy.ts';
import { claudeAdapter } from './adapters/claude.ts';
import { createAgentService } from './agent-service.ts';
import { createTurnSnapshotStore } from './snapshot/snapshot-store.ts';
import { makeTestProjectInfo, writeTestProjectFiles } from './test-support.ts';
import { createTurnRunner } from './turn-runner.ts';
import { createTurnStore } from './turn-store.ts';

function createMockProcess(
  spawnedCommands: Array<{ cmd: string; args: readonly string[] }>,
): ProcessPort {
  return {
    spawn(command: string, args: readonly string[]): ChildProcessHandle {
      spawnedCommands.push({ cmd: command, args });
      return {
        onLine(): void {},
        wait(): Promise<{
          exitCode: number;
          stdout: string;
          stderr: string;
          lines: readonly string[];
        }> {
          if (args[0] === '--version') {
            return Promise.resolve({
              exitCode: 0,
              stdout: '1.4.3\n',
              stderr: '',
              lines: ['1.4.3'],
            });
          }
          if (args[0] === 'models') {
            return Promise.resolve({
              exitCode: 1,
              stdout: '',
              stderr: 'Please sign in to view available models.',
              lines: [],
            });
          }
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '', lines: [] });
        },
        kill(): Promise<void> {
          return Promise.resolve();
        },
      };
    },
  };
}

describe('TurnRunner login gate [R-AG-21]', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'rc-turn-login-'));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('[R-AG-21] refuses to start AI turn when agy is loggedOut without spawning agent process with -p', async () => {
    const projectRoot = join(tempDir, 'project');
    const dataDir = join(tempDir, 'data');
    const cacheDir = join(tempDir, 'cache');
    await writeTestProjectFiles(projectRoot, dataDir, cacheDir);

    const spawnedCommands: Array<{ cmd: string; args: readonly string[] }> = [];
    const mockProcess = createMockProcess(spawnedCommands);

    const platform = toSupportedPlatform(process.platform) ?? 'linux';
    const fs = createNodeFileSystem(platform);
    const eventBus = createEventBus();
    const jobs = createJobService({
      system: { now: () => new Date() },
      logger: silentLogger,
      eventBus,
    });

    const agentService = createAgentService({
      process: mockProcess,
      settings: () => ({ editor: 'vscode', agent: { preferred: 'agy' } }),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
    });

    const mirror = createMirrorService({ fs, cacheDir, logger: silentLogger });
    const snapshots = createTurnSnapshotStore({ fs, dataDir, logger: silentLogger });
    const store = createTurnStore({ fs, dataDir });

    const turnRunner = createTurnRunner({
      fs,
      process: mockProcess,
      jobs,
      agents: agentService,
      mirror,
      snapshots,
      store,
      project: () => ok(makeTestProjectInfo(projectRoot)),
      eventBus,
      logger: silentLogger,
      now: () => new Date(),
    });

    const res = await turnRunner.start({
      prompt: 'Do something',
      context: {},
      conversation: 'new',
      docs: [],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('E026');
      expect(res.error.params).toEqual({
        agent: 'agy',
        reason: 'notLoggedIn',
      });
    }

    const hasPromptArg = spawnedCommands.some((c) => c.args.includes('-p'));
    expect(hasPromptArg).toBe(false);
  });
});
