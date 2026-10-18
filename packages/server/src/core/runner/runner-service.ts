import { stripVTControlCharacters } from 'node:util';

import {
  type AppError,
  err,
  type ErrorDetail,
  ok,
  type Result,
  type RunnerOptions,
  type RunnerStatus,
  type RunnerToChildMessage,
  type RunnerToParentMessage,
  RunnerToParentMessageSchema,
  type WorkspaceFile,
} from '@reactcraft/shared';
import { nanoid } from 'nanoid';

import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ChildProcessHandle, ProcessPort } from '../ports/process-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import type { FrameworkAdapter } from '../project/frameworks/types.ts';
import type { WorkspaceState } from '../project/project-service.ts';
import { findRunnerPort } from './port-finder.ts';
import { redactSecrets } from './redact-secrets.ts';

export type RunnerServiceDeps = {
  readonly getWorkspaceState: () => WorkspaceState;
  readonly system: Pick<SystemPort, 'isListening'>;
  readonly process: ProcessPort;
  readonly logger: LoggerPort;
  readonly eventBus?: EventBusPort | undefined;
  readonly studioOrigin: string;
  readonly adapter: FrameworkAdapter;
  readonly runnerScriptPath?: string | undefined;
  readonly startupTimeoutMs?: number | undefined;
  readonly stopGracePeriodMs?: number | undefined;
};

export interface RunnerService {
  getStatus(): RunnerStatus;
  start(): Promise<Result<RunnerStatus>>;
  restart(): Promise<Result<RunnerStatus>>;
  stop(): Promise<Result<RunnerStatus>>;
  dispose(): Promise<void>;
}

class RunnerLogBuffer {
  private readonly buffer: string[] = [];
  private readonly pending: string[] = [];
  private readonly eventBus?: EventBusPort | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(eventBus?: EventBusPort) {
    this.eventBus = eventBus;
  }

  push(colouredLine: string): void {
    // Vite colours its log for terminals; the Studio shows plain text.
    const rawLine = stripVTControlCharacters(colouredLine);
    const truncated = rawLine.length > 2000 ? rawLine.slice(0, 2000) : rawLine;
    const redacted = redactSecrets(truncated);
    this.buffer.push(redacted);
    if (this.buffer.length > 500) {
      this.buffer.shift();
    }
    this.pending.push(redacted);
    this.scheduleFlush();
  }

  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.pending.length === 0) return;
    const batch = this.pending.splice(0, 100);
    this.eventBus?.publish('runner.log', { stream: 'stdout', lines: batch });
  }

  private scheduleFlush(): void {
    if (this.pending.length >= 100) {
      this.flush();
      return;
    }
    if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.flush();
      }, 200);
    }
  }

  getTail(count: number): ErrorDetail[] {
    return this.buffer.slice(-count).map((message) => ({ message }));
  }
}

function checkProjectEligibility(
  getState: () => WorkspaceState,
): Result<Extract<WorkspaceState, { status: 'open' }>> {
  const state = getState();
  if (state.status !== 'open') {
    return err({ code: 'E021' });
  }
  if (!state.trusted) {
    return err({ code: 'E011', params: { reason: 'untrusted' } });
  }
  if (state.needsInstall) {
    return err({ code: 'E025', params: { reason: 'notInstalled' } });
  }
  return ok(state);
}

function toRunnerError(msg: Extract<RunnerToParentMessage, { type: 'error' }>): AppError {
  return {
    code: 'E025',
    params: {
      reason: msg.reason,
      ...(msg.message ? { message: msg.message } : {}),
      ...(msg.file ? { file: msg.file } : {}),
      ...(msg.line !== undefined ? { line: msg.line } : {}),
    },
  };
}

async function stopChildProcess(handle: ChildProcessHandle, gracePeriodMs: number): Promise<void> {
  const stopMsg: RunnerToChildMessage = { type: 'stop' };
  handle.send?.(stopMsg);

  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    handle.wait(),
    new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        void (async () => {
          await handle.kill();
          resolve();
        })();
      }, gracePeriodMs);
    }),
  ]);

  if (timer !== undefined) {
    clearTimeout(timer);
  }
}

class RunnerExecution {
  private currentStatus: RunnerStatus = { state: 'stopped' };
  private rememberedPort: number | undefined;
  private activeHandle: ChildProcessHandle | undefined;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;
  private isStopping = false;

  private readonly deps: RunnerServiceDeps;
  private readonly logs: RunnerLogBuffer;
  private readonly startupTimeoutMs: number;
  private readonly stopGracePeriodMs: number;

  constructor(deps: RunnerServiceDeps) {
    this.deps = deps;
    this.logs = new RunnerLogBuffer(deps.eventBus);
    this.startupTimeoutMs = deps.startupTimeoutMs ?? 60_000;
    this.stopGracePeriodMs = deps.stopGracePeriodMs ?? 5_000;
  }

  getStatus(): RunnerStatus {
    return this.currentStatus;
  }

  private emitStatus(): void {
    this.deps.eventBus?.publish('runner.status', this.currentStatus);
  }

  private clearStartupTimer(): void {
    if (this.startupTimer !== undefined) {
      clearTimeout(this.startupTimer);
      this.startupTimer = undefined;
    }
  }

  private onChildMessage(msg: RunnerToParentMessage): void {
    this.clearStartupTimer();
    if (msg.type === 'ready') {
      this.currentStatus = {
        state: 'ready',
        origin: `http://127.0.0.1:${String(msg.port)}`,
        nonce: this.currentStatus.nonce,
        startedAt: this.currentStatus.startedAt,
        ...(msg.busyPort === undefined ? {} : { busyPort: msg.busyPort }),
      };
      this.emitStatus();
    } else {
      this.currentStatus = { state: 'error', error: toRunnerError(msg) };
      this.emitStatus();
      if (this.activeHandle) {
        const handle = this.activeHandle;
        void (async () => {
          await handle.kill();
        })();
      }
    }
  }

  private onChildExit(): void {
    this.clearStartupTimer();
    if (this.isStopping) return;

    if (this.currentStatus.state === 'starting' || this.currentStatus.state === 'ready') {
      this.currentStatus = {
        state: 'crashed',
        error: {
          code: 'E025',
          params: { reason: 'crashed' },
          details: this.logs.getTail(50),
        },
      };
      this.emitStatus();
    }
  }

  private setupProcess(handle: ChildProcessHandle): void {
    handle.onLine((line) => {
      this.logs.push(line);
    });
    handle.onMessage?.((raw: unknown) => {
      // Only the runner's own messages count. Anything else on the channel (a plugin or library
      // of the project calling process.send) must not turn into a dev server error.
      const parsed = RunnerToParentMessageSchema.safeParse(raw);
      if (parsed.success) {
        this.onChildMessage(parsed.data);
      } else {
        this.logs.push(
          '[reactcraft] ignored a message from the dev server process it does not know',
        );
      }
    });
    void (async () => {
      await handle.wait();
      this.onChildExit();
    })();
  }

  private setupTimeout(handle: ChildProcessHandle): void {
    this.startupTimer = setTimeout(() => {
      void (async () => {
        await handle.kill();
        this.currentStatus = {
          state: 'error',
          error: { code: 'E025', params: { reason: 'timeout' } },
        };
        this.emitStatus();
      })();
    }, this.startupTimeoutMs);
  }

  private spawnProcess(
    project: { readonly root: string; readonly file: WorkspaceFile },
    port: number,
    nonce: string,
  ): ChildProcessHandle {
    const entryPath = this.deps.runnerScriptPath ?? '';
    const { root } = project;

    const runnerOptions: RunnerOptions = this.deps.adapter.runner.options({
      root,
      sourceDir: project.file.sourceDir,
      port,
      ...(project.file.devPort === undefined ? {} : { projectPort: project.file.devPort }),
      nonce,
      studioOrigin: this.deps.studioOrigin,
    });

    const handle = this.deps.process.spawn(process.execPath, [entryPath], {
      cwd: root,
      ipc: true,
      env: { NODE_ENV: 'development' },
    });

    this.setupProcess(handle);
    this.setupTimeout(handle);

    const startMsg: RunnerToChildMessage = { type: 'start', options: runnerOptions };
    handle.send?.(startMsg);
    return handle;
  }

  async start(): Promise<Result<RunnerStatus>> {
    if (this.currentStatus.state === 'starting' || this.currentStatus.state === 'ready') {
      return ok(this.currentStatus);
    }
    const check = checkProjectEligibility(this.deps.getWorkspaceState);
    if (!check.ok) return check;
    const project = check.value;

    const port = await findRunnerPort(this.deps.system, this.rememberedPort);
    if (port === undefined) {
      this.currentStatus = {
        state: 'error',
        error: { code: 'E025', params: { reason: 'portInUse' } },
      };
      this.emitStatus();
      return err({ code: 'E025', params: { reason: 'portInUse' } });
    }
    this.rememberedPort = port;
    this.isStopping = false;
    // V-114: 22 random characters, new for every dev server start.
    const nonce = nanoid(22);
    this.currentStatus = {
      state: 'starting',
      origin: `http://127.0.0.1:${String(port)}`,
      nonce,
      startedAt: new Date().toISOString(),
    };
    this.emitStatus();

    this.activeHandle = this.spawnProcess(project, port, nonce);
    return ok(this.currentStatus);
  }

  async stop(): Promise<Result<RunnerStatus>> {
    if (this.currentStatus.state === 'stopped') {
      return ok(this.currentStatus);
    }
    this.isStopping = true;
    this.clearStartupTimer();

    if (this.activeHandle) {
      const handle = this.activeHandle;
      this.activeHandle = undefined;
      await stopChildProcess(handle, this.stopGracePeriodMs);
    }

    this.currentStatus = { state: 'stopped' };
    this.emitStatus();
    this.logs.flush();
    return ok(this.currentStatus);
  }

  async restart(): Promise<Result<RunnerStatus>> {
    await this.stop();
    return this.start();
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}

export function createRunnerService(deps: RunnerServiceDeps): RunnerService {
  const execution = new RunnerExecution(deps);
  return {
    getStatus: () => execution.getStatus(),
    start: () => execution.start(),
    restart: () => execution.restart(),
    stop: () => execution.stop(),
    dispose: () => execution.dispose(),
  };
}
