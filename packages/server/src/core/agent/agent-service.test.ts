// Tests for AgentService (WP-3.03a, R-AG-10, R-QA-12).
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createNodeProcess } from '../../adapters/system/node-process.ts';
import type { ChildProcessHandle, ProcessPort, SpawnOptions } from '../ports/process-port.ts';
import type { Settings } from '../shared/user-config.ts';
import { agyAdapter } from './adapters/agy.ts';
import { claudeAdapter } from './adapters/claude.ts';
import { createAgentService } from './agent-service.ts';

const FAKE_AGENT_PATH = fileURLToPath(
  new URL('../../../test-support/fake-agent.mjs', import.meta.url),
);

function makeSettings(preferred: 'auto' | 'agy' | 'claude'): () => Settings {
  return () => ({
    editor: 'vscode',
    agent: { preferred },
  });
}

function createMockProcessPort(
  handler: (
    command: string,
    args: readonly string[],
    options: SpawnOptions,
  ) => {
    exitCode: number;
    stdout?: string;
    stderr?: string;
    lines?: readonly string[];
  },
): ProcessPort {
  return {
    spawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcessHandle {
      const out = handler(command, args, options);
      const stdout = out.stdout ?? '';
      const stderr = out.stderr ?? '';
      const lines = out.lines ?? stdout.split(/\r?\n/).filter((l) => l.length > 0);
      return {
        onLine(cb: (line: string) => void): void {
          for (const l of lines) cb(l);
        },
        wait: () =>
          Promise.resolve({
            exitCode: out.exitCode,
            stdout,
            stderr,
            lines,
          }),
        kill: () => Promise.resolve(),
      };
    },
  };
}

describe('AgentService', () => {
  const proc = createNodeProcess();

  it('[R-AG-10, R-QA-12] detects installed and missing agents in parallel, and resolves according to preference', async () => {
    let currentPreferred: 'auto' | 'agy' | 'claude' = 'auto';
    const service = createAgentService({
      process: proc,
      settings: () => makeSettings(currentPreferred)(),
      commands: {
        agy: { command: process.execPath, prefixArgs: [FAKE_AGENT_PATH] },
        claude: { command: 'rc-no-such-agent-xyz', prefixArgs: [] },
      },
      adapters: { agy: agyAdapter, claude: claudeAdapter },
    });

    const statuses = await service.statuses();
    expect(statuses).toEqual([
      {
        id: 'agy',
        installed: true,
        version: '0.0.0-fake',
        login: 'loggedIn',
        loginAvailable: false,
      },
      { id: 'claude', installed: false, login: 'unknown', loginAvailable: false },
    ]);

    // auto -> agy
    currentPreferred = 'auto';
    const autoRes = await service.resolve();
    expect(autoRes.ok).toBe(true);
    if (autoRes.ok) {
      expect(autoRes.value.adapter.id).toBe('agy');
      expect(autoRes.value.status.installed).toBe(true);
    }

    // claude -> E026 notInstalled
    currentPreferred = 'claude';
    const claudeRes = await service.resolve();
    expect(claudeRes.ok).toBe(false);
    if (!claudeRes.ok) {
      expect(claudeRes.error.code).toBe('E026');
      expect(claudeRes.error.params).toEqual({
        agent: 'claude',
        reason: 'notInstalled',
      });
    }

    // agy -> agy
    currentPreferred = 'agy';
    const agyRes = await service.resolve();
    expect(agyRes.ok).toBe(true);
    if (agyRes.ok) {
      expect(agyRes.value.adapter.id).toBe('agy');
    }
  });

  it('[R-AG-10] timeout handling marks agent as uninstalled within timeout limit', async () => {
    const startTime = Date.now();
    const service = createAgentService({
      process: proc,
      settings: makeSettings('auto'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
      commands: {
        agy: {
          command: process.execPath,
          prefixArgs: ['-e', 'setTimeout(() => {}, 10000)', '--'],
        },
        claude: { command: 'rc-no-such-agent-xyz', prefixArgs: [] },
      },
      detectTimeoutMs: 300,
    });

    const statuses = await service.statuses();
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(2000);
    expect(statuses[0]?.installed).toBe(false);
    expect(statuses[0]?.id).toBe('agy');
  });

  it('[R-AG-10] falls back to fallbackCommand when primary version check fails with 127', async () => {
    const fallbackExe = '/opt/bin/agy';
    const fakeProc = createMockProcessPort((cmd, args) => {
      if (cmd === 'agy' && args[0] === '--version') {
        return { exitCode: 127, stdout: '', stderr: 'command not found' };
      }
      if (cmd === fallbackExe && args[0] === '--version') {
        return { exitCode: 0, stdout: '1.4.3\n', stderr: '' };
      }
      if (cmd === fallbackExe && args[0] === 'models') {
        return { exitCode: 0, stdout: 'gemini-pro\n', stderr: '' };
      }
      return { exitCode: 127, stdout: '', stderr: 'unknown' };
    });

    const service = createAgentService({
      process: fakeProc,
      settings: makeSettings('agy'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
      fallbackCommands: { agy: { command: fallbackExe, prefixArgs: [] } },
    });

    const statuses = await service.statuses();
    expect(statuses[0]?.installed).toBe(true);
    expect(statuses[0]?.version).toBe('1.4.3');

    const resolved = await service.resolve();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.command.command).toBe(fallbackExe);
    }
  });

  it('[R-AG-10, R-QA-12] does not try fallback when an explicit test command fails', async () => {
    let triedFallback = false;
    const fakeProc = createMockProcessPort((cmd) => {
      if (cmd === '/opt/bin/agy') {
        triedFallback = true;
        return { exitCode: 0, stdout: '1.4.3\n', stderr: '' };
      }
      return { exitCode: 127, stdout: '', stderr: 'not found' };
    });

    const service = createAgentService({
      process: fakeProc,
      settings: makeSettings('auto'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
      commands: { agy: { command: 'nonexistent-test-agent', prefixArgs: [] } },
      fallbackCommands: { agy: { command: '/opt/bin/agy', prefixArgs: [] } },
    });

    const statuses = await service.statuses();
    expect(statuses[0]?.installed).toBe(false);
    expect(triedFallback).toBe(false);
  });

  it('[R-AG-10, R-AG-21] probes agy login state across models exit codes and outputs', async () => {
    const spawned: Array<{ cmd: string; args: readonly string[] }> = [];
    let modelsResult = { exitCode: 0, stdout: 'model-1', stderr: '' };

    const fakeProc = createMockProcessPort((cmd, args) => {
      spawned.push({ cmd, args });
      if (args[0] === '--version') {
        return { exitCode: 0, stdout: '1.0.0\n', stderr: '' };
      }
      if (args[0] === 'models') {
        return modelsResult;
      }
      return { exitCode: 127, stdout: '', stderr: '' };
    });

    const service = createAgentService({
      process: fakeProc,
      settings: makeSettings('auto'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
    });

    modelsResult = { exitCode: 0, stdout: 'model-1', stderr: '' };
    let statuses = await service.statuses();
    expect(statuses[0]?.login).toBe('loggedIn');
    expect(spawned.some((s) => s.cmd === 'agy' && s.args[0] === 'models')).toBe(true);

    modelsResult = { exitCode: 1, stdout: '', stderr: 'Please sign in to view available models' };
    statuses = await service.statuses();
    expect(statuses[0]?.login).toBe('loggedOut');

    modelsResult = { exitCode: 1, stdout: '', stderr: 'Network unreachable' };
    statuses = await service.statuses();
    expect(statuses[0]?.login).toBe('unknown');

    modelsResult = { exitCode: 124, stdout: '', stderr: '' };
    statuses = await service.statuses();
    expect(statuses[0]?.login).toBe('unknown');
  });

  it('[R-AG-21, VG-17] reads claude login from `auth status`; an older claude without it stays unknown', async () => {
    const run = async (authStatus: { exitCode: number; stdout: string }) => {
      const spawnedArgs: Array<readonly string[]> = [];
      const fakeProc = createMockProcessPort((cmd, args) => {
        spawnedArgs.push(args);
        if (cmd === 'claude' && args[0] === '--version') {
          return { exitCode: 0, stdout: '2.1.0\n', stderr: '' };
        }
        if (cmd === 'claude' && args[0] === 'auth') return { ...authStatus, stderr: '' };
        return { exitCode: 127, stdout: '', stderr: '' };
      });
      const service = createAgentService({
        process: fakeProc,
        settings: makeSettings('claude'),
        adapters: { agy: agyAdapter, claude: claudeAdapter },
      });
      const claudeStatus = (await service.statuses()).find((s) => s.id === 'claude');
      return { claudeStatus, spawnedArgs };
    };

    const signedIn = await run({ exitCode: 0, stdout: '{"loggedIn": true}' });
    expect(signedIn.claudeStatus?.login).toBe('loggedIn');
    // The probe is the read-only status command, never a turn.
    expect(signedIn.spawnedArgs).toContainEqual(['auth', 'status']);

    const older = await run({ exitCode: 1, stdout: 'error: unknown command' });
    expect(older.claudeStatus?.installed).toBe(true);
    expect(older.claudeStatus?.login).toBe('unknown');
  });

  it('[R-AG-21] rejects resolve() with E026 notLoggedIn when preferred agy is loggedOut', async () => {
    const fakeProc = createMockProcessPort((_cmd, args) => {
      if (args[0] === '--version') {
        return { exitCode: 0, stdout: '1.0.0\n', stderr: '' };
      }
      if (args[0] === 'models') {
        return { exitCode: 1, stdout: '', stderr: 'Please sign in to continue' };
      }
      return { exitCode: 127, stdout: '', stderr: '' };
    });

    const service = createAgentService({
      process: fakeProc,
      settings: makeSettings('agy'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
    });

    const res = await service.resolve();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('E026');
      expect(res.error.params).toEqual({
        agent: 'agy',
        reason: 'notLoggedIn',
      });
    }
  });

  it('[R-AG-10] auto preference skips loggedOut agy to choose installed claude, or returns E026 if only agy is installed', async () => {
    const procWithBoth = createMockProcessPort((cmd, args) => {
      if (args[0] === '--version') {
        return { exitCode: 0, stdout: '1.0.0\n', stderr: '' };
      }
      if (cmd === 'agy' && args[0] === 'models') {
        return { exitCode: 1, stdout: '', stderr: 'Please sign in' };
      }
      return { exitCode: 127, stdout: '', stderr: '' };
    });

    const serviceWithBoth = createAgentService({
      process: procWithBoth,
      settings: makeSettings('auto'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
    });

    const res1 = await serviceWithBoth.resolve();
    expect(res1.ok).toBe(true);
    if (res1.ok) {
      expect(res1.value.adapter.id).toBe('claude');
    }

    const procOnlyAgy = createMockProcessPort((cmd, args) => {
      if (cmd === 'agy' && args[0] === '--version') {
        return { exitCode: 0, stdout: '1.0.0\n', stderr: '' };
      }
      if (cmd === 'agy' && args[0] === 'models') {
        return { exitCode: 1, stdout: '', stderr: 'Please sign in' };
      }
      return { exitCode: 127, stdout: '', stderr: '' };
    });

    const serviceOnlyAgy = createAgentService({
      process: procOnlyAgy,
      settings: makeSettings('auto'),
      adapters: { agy: agyAdapter, claude: claudeAdapter },
    });

    const res2 = await serviceOnlyAgy.resolve();
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.error.code).toBe('E026');
      expect(res2.error.params).toEqual({
        agent: 'agy',
        reason: 'notLoggedIn',
      });
    }
  });
});
