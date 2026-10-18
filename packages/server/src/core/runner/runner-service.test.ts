import type { RunnerToChildMessage } from '@reactcraft/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServerEvent } from '../ports/event-bus-port.ts';
import type { ChildProcessHandle, ProcessPort } from '../ports/process-port.ts';
import { viteReactAdapter } from '../project/frameworks/vite-react/index.ts';
import type { WorkspaceState } from '../project/project-service.ts';
import { createRunnerService, type RunnerServiceDeps } from './runner-service.ts';

type MockProcessHandle = ChildProcessHandle & {
  triggerLine(line: string): void;
  triggerMessage(msg: unknown): void;
  triggerExit(code?: number): void;
  sentMessages: unknown[];
  killed: boolean;
};

function createMockHandle(): MockProcessHandle {
  const lineListeners: ((line: string) => void)[] = [];
  const messageListeners: ((msg: unknown) => void)[] = [];
  let exitResolver: (val: {
    exitCode: number;
    stdout: string;
    stderr: string;
    lines: string[];
  }) => void;
  const exitPromise = new Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    lines: string[];
  }>((resolve) => {
    exitResolver = resolve;
  });

  const handle: MockProcessHandle = {
    pid: 12345,
    sentMessages: [],
    killed: false,
    onLine(cb) {
      lineListeners.push(cb);
    },
    onMessage(cb) {
      messageListeners.push(cb);
    },
    send(msg) {
      handle.sentMessages.push(msg);
      return true;
    },
    wait() {
      return exitPromise;
    },
    kill() {
      handle.killed = true;
      exitResolver({ exitCode: 1, stdout: '', stderr: '', lines: [] });
      return Promise.resolve();
    },
    triggerLine(line: string) {
      for (const cb of lineListeners) cb(line);
    },
    triggerMessage(msg: unknown) {
      for (const cb of messageListeners) cb(msg);
    },
    triggerExit(code = 0) {
      exitResolver({ exitCode: code, stdout: '', stderr: '', lines: [] });
    },
  };

  return handle;
}

describe('RunnerService [SPEC-04 M-RN, R-RN-01 to R-RN-09]', () => {
  let mockHandle: MockProcessHandle;
  let spawnedCalls: { command: string; args: readonly string[]; options: unknown }[];
  let mockProcess: ProcessPort;
  let workspaceState: WorkspaceState;
  let events: ServerEvent[];
  let occupiedPorts: Set<number>;

  const openState: Extract<WorkspaceState, { status: 'open' }> = {
    status: 'open',
    root: 'D:/mock-project',
    file: {
      schemaVersion: 2,
      id: 'proj_1',
      name: 'Mock Project',
      createdAt: '2026-10-14T00:00:00.000Z',
      framework: 'vite-react',
      sourceDir: 'src',
      responsiveMode: 'desktop-first',
      frames: [],
      primaryFrameId: 'desktop',
      backends: [],
    },
    support: {
      supported: true,
      reasons: [],
      versions: { vite: '6.0.0', react: '19.0.0', tailwindcss: '4.0.0' },
      language: 'ts',
    },
    trusted: true,
    needsInstall: false,
    backends: [],
  };

  beforeEach(() => {
    mockHandle = createMockHandle();
    spawnedCalls = [];
    occupiedPorts = new Set();
    workspaceState = openState;
    events = [];

    mockProcess = {
      spawn(cmd, args, options) {
        spawnedCalls.push({ command: cmd, args, options });
        return mockHandle;
      },
    };
  });

  function makeDeps(overrides?: Partial<RunnerServiceDeps>): RunnerServiceDeps {
    return {
      getWorkspaceState: () => workspaceState,
      system: {
        isListening: (p) => Promise.resolve(occupiedPorts.has(p)),
      },
      process: mockProcess,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(),
      },
      eventBus: {
        publish: (type, payload) => {
          events.push({ v: 1, type, at: new Date().toISOString(), payload });
        },
        subscribe: vi.fn(),
      },
      studioOrigin: 'http://127.0.0.1:4173',
      adapter: viteReactAdapter,
      startupTimeoutMs: 50,
      stopGracePeriodMs: 50,
      ...overrides,
    };
  }

  it('rejects start if project is not open [E021]', async () => {
    workspaceState = { status: 'none' };
    const runner = createRunnerService(makeDeps());
    const result = await runner.start();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('E021');
  });

  it('rejects start if project is untrusted, E011 untrusted [S-105]', async () => {
    workspaceState = { ...openState, trusted: false };
    const runner = createRunnerService(makeDeps());
    const result = await runner.start();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('E011');
      expect(result.error.params?.reason).toBe('untrusted');
    }
  });

  it('rejects start if project needsInstall [E025 notInstalled]', async () => {
    workspaceState = { ...openState, needsInstall: true };
    const runner = createRunnerService(makeDeps());
    const result = await runner.start();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('E025');
      expect(result.error.params?.reason).toBe('notInstalled');
    }
  });

  it('transitions stopped -> starting -> ready upon child IPC ready [R-RN-01, R-RN-09, V-114]', async () => {
    const runner = createRunnerService(makeDeps());
    expect(runner.getStatus().state).toBe('stopped');

    await runner.start();
    expect(runner.getStatus().state).toBe('starting');
    expect(runner.getStatus().nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(runner.getStatus().origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    expect(spawnedCalls).toHaveLength(1);
    expect(mockHandle.sentMessages).toHaveLength(1);
    const startMsg = mockHandle.sentMessages[0] as RunnerToChildMessage;
    expect(startMsg.type).toBe('start');

    // Child sends ready
    mockHandle.triggerMessage({ type: 'ready', port: 52123 });

    expect(runner.getStatus().state).toBe('ready');
    expect(runner.getStatus().origin).toBe('http://127.0.0.1:52123');

    const statusEvents = events.filter((e) => e.type === 'runner.status');
    expect(statusEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores consecutive start calls when already starting or ready [R-RN-01]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();
    mockHandle.triggerMessage({ type: 'ready', port: 52123 });

    const secondStart = await runner.start();
    expect(secondStart.ok).toBe(true);
    expect(spawnedCalls).toHaveLength(1); // Only 1 process spawned
  });

  it('handles child config error by transitioning to error and killing process [R-RN-06]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();

    mockHandle.triggerMessage({
      type: 'error',
      reason: 'config',
      message: 'Failed to load vite.config.ts',
      file: 'vite.config.ts',
      line: 12,
    });

    expect(runner.getStatus().state).toBe('error');
    expect(runner.getStatus().error?.code).toBe('E025');
    expect(runner.getStatus().error?.params?.reason).toBe('config');
    expect(runner.getStatus().error?.params?.file).toBe('vite.config.ts');
    expect(mockHandle.killed).toBe(true);
  });

  it('handles unexpected child exit as crashed without auto-restart [R-RN-06]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();
    mockHandle.triggerMessage({ type: 'ready', port: 52123 });
    expect(runner.getStatus().state).toBe('ready');

    mockHandle.triggerLine('Some application log 1');
    mockHandle.triggerLine('Fatal segmentation fault in native addon');
    mockHandle.triggerExit(1);

    // Wait microtask for handle.wait()
    await new Promise((r) => setTimeout(r, 10));

    expect(runner.getStatus().state).toBe('crashed');
    expect(runner.getStatus().error?.code).toBe('E025');
    expect(runner.getStatus().error?.params?.reason).toBe('crashed');
    expect(runner.getStatus().error?.details).toHaveLength(2);
    expect(runner.getStatus().error?.details?.[1]?.message).toContain('Fatal segmentation fault');
    expect(spawnedCalls).toHaveLength(1); // Did NOT auto-restart
  });

  it('triggers error timeout when child does not report ready in time [R-RN-05]', async () => {
    const runner = createRunnerService(makeDeps({ startupTimeoutMs: 20 }));
    await runner.start();

    // Do not trigger ready, wait for 20ms timeout
    await new Promise((r) => setTimeout(r, 40));

    expect(runner.getStatus().state).toBe('error');
    expect(runner.getStatus().error?.params?.reason).toBe('timeout');
    expect(mockHandle.killed).toBe(true);
  });

  it('stops cleanly with IPC stop and force kills after grace period [R-RN-07]', async () => {
    const runner = createRunnerService(makeDeps({ stopGracePeriodMs: 20 }));
    await runner.start();
    mockHandle.triggerMessage({ type: 'ready', port: 52123 });

    // Calling stop sends stop message
    const stopPromise = runner.stop();
    expect(mockHandle.sentMessages).toHaveLength(2);
    expect((mockHandle.sentMessages[1] as RunnerToChildMessage).type).toBe('stop');

    // Child does not exit immediately; grace period expires and kills it
    await stopPromise;
    expect(mockHandle.killed).toBe(true);
    expect(runner.getStatus().state).toBe('stopped');
  });

  it('reuses port on restart, falls back to new port if occupied [R-RN-04]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();
    const firstOrigin = runner.getStatus().origin;
    const firstPort = Number(firstOrigin?.split(':').pop());
    mockHandle.triggerMessage({ type: 'ready', port: firstPort });
    await runner.stop();

    // Now mark the old port as occupied
    occupiedPorts.add(firstPort);

    // Next mock handle for restart
    mockHandle = createMockHandle();
    await runner.start();
    const secondOrigin = runner.getStatus().origin;
    const secondPort = Number(secondOrigin?.split(':').pop());

    expect(secondPort).not.toBe(firstPort);
    expect(secondPort).toBeGreaterThanOrEqual(49152);
  });

  it('verifies spawned child environment has NODE_ENV=development and no secrets [S-53]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();

    const spawnOpts = spawnedCalls[0]?.options as { env?: Record<string, string> } | undefined;
    expect(spawnOpts?.env?.NODE_ENV).toBe('development');
    expect(spawnOpts?.env?.REACTCRAFT_SESSION_TOKEN).toBeUndefined();
  });

  it('cuts long lines and keeps the last 500 lines for E025 [R-RN-08, V-71]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();
    mockHandle.triggerMessage({ type: 'ready', port: 52123 });
    expect(runner.getStatus().state).toBe('ready');

    for (let i = 1; i <= 600; i++) {
      mockHandle.triggerLine(`line ${String(i)}`);
    }
    mockHandle.triggerLine('x'.repeat(2500));

    await new Promise((r) => setTimeout(r, 250));
    mockHandle.triggerExit(1);
    await new Promise((r) => setTimeout(r, 50));

    const status = runner.getStatus();
    expect(status.state).toBe('crashed');
    expect(status.error?.details).toHaveLength(50);

    const logEvents = events.filter((e) => e.type === 'runner.log');
    const allLines = logEvents.flatMap((e) => (e.payload as { lines: string[] }).lines);
    const truncatedLine = allLines.find((l) => l.startsWith('xxxx'));
    expect(truncatedLine?.length).toBe(2000);
    for (const line of allLines) {
      expect(line.length).toBeLessThanOrEqual(2000);
    }
  });

  it('sends Vite output without terminal colour codes [V-71]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();
    mockHandle.triggerMessage({ type: 'ready', port: 52123 });

    mockHandle.triggerLine('[2m12:45:01 am[22m [32mhmr update[39m /src/App.tsx');
    await new Promise((r) => setTimeout(r, 250));

    const lines = events
      .filter((e) => e.type === 'runner.log')
      .flatMap((e) => (e.payload as { lines: string[] }).lines);
    expect(lines).toContain('12:45:01 am hmr update /src/App.tsx');
    expect(lines.some((line) => line.includes(''))).toBe(false);
  });

  it('runs the dev server in the project root [S-52]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();
    const spawnOpts = spawnedCalls[0]?.options as { cwd?: string } | undefined;
    expect(spawnOpts?.cwd).toBe(openState.root);
  });

  it("passes the user's port to the runner and reports when the project's port is busy [R-RN-04, R-RN-27]", async () => {
    workspaceState = { ...openState, file: { ...openState.file, devPort: 3000 } };
    const runner = createRunnerService(makeDeps());
    await runner.start();

    const startMsg = mockHandle.sentMessages[0] as RunnerToChildMessage;
    expect(startMsg.type === 'start' && startMsg.options.projectPort).toBe(3000);

    mockHandle.triggerMessage({ type: 'ready', port: 52123, busyPort: 3000 });
    expect(runner.getStatus()).toMatchObject({
      state: 'ready',
      origin: 'http://127.0.0.1:52123',
      busyPort: 3000,
    });
  });

  it('ignores messages on the channel that the runner did not send, instead of failing [R-RN-06]', async () => {
    const runner = createRunnerService(makeDeps());
    await runner.start();

    mockHandle.triggerMessage({ type: 'progress', percent: 40 });
    mockHandle.triggerMessage({ cmd: 'NODE_SOMETHING' });
    expect(runner.getStatus().state).toBe('starting');

    mockHandle.triggerMessage({ type: 'ready', port: 52123 });
    expect(runner.getStatus().state).toBe('ready');

    await new Promise((r) => setTimeout(r, 250));
    const lines = events
      .filter((e) => e.type === 'runner.log')
      .flatMap((e) => (e.payload as { lines: string[] }).lines);
    expect(lines.filter((l) => l.includes('does not know'))).toHaveLength(2);
  });
});
