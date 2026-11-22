import {
  type ChildProcess,
  execFile,
  type Serializable,
  spawn as nodeSpawn,
} from 'node:child_process';
import { createInterface } from 'node:readline';

import crossSpawn from 'cross-spawn';

import type {
  ChildProcessHandle,
  ProcessOutput,
  ProcessPort,
  SpawnOptions,
} from '../../ports/process-port.ts';

/** S-53: Strip KUMICRAFT_* env vars. Agent auth tokens (e.g. GH_TOKEN) are preserved. */
export function sanitizeEnvironment(
  baseEnv: NodeJS.ProcessEnv,
  extraEnv?: Readonly<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value === undefined) continue;
    if (key.startsWith('KUMICRAFT_')) continue;
    result[key] = value;
  }
  if (extraEnv !== undefined) {
    for (const [key, value] of Object.entries(extraEnv)) {
      result[key] = value;
    }
  }
  return result;
}

async function killProcessTree(pid: number | undefined, isWin: boolean): Promise<void> {
  if (pid === undefined || pid <= 0) return;
  if (isWin) {
    await new Promise<void>((res) => {
      execFile('taskkill', ['/T', '/F', '/PID', pid.toString()], () => {
        res();
      });
    });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }
}

type OutputBuffer = {
  readonly lines: readonly string[];
  readonly getStdout: () => string;
  readonly getStderr: () => string;
  readonly addListener: (cb: (line: string) => void) => void;
};

function setupOutputBuffer(child: ChildProcess): OutputBuffer {
  const lines: string[] = [];
  const listeners: ((line: string) => void)[] = [];
  let stdoutAccum = '';
  let stderrAccum = '';

  const handleLine = (line: string) => {
    lines.push(line);
    if (lines.length > 500) lines.shift();
    for (const cb of listeners) cb(line);
  };

  if (child.stdout) {
    const rlOut = createInterface({ input: child.stdout });
    rlOut.on('line', (line) => {
      stdoutAccum += `${line}\n`;
      handleLine(line);
    });
  }

  if (child.stderr) {
    const rlErr = createInterface({ input: child.stderr });
    rlErr.on('line', (line) => {
      stderrAccum += `${line}\n`;
      handleLine(line);
    });
  }

  return {
    lines,
    getStdout: () => stdoutAccum,
    getStderr: () => stderrAccum,
    addListener: (cb) => {
      listeners.push(cb);
    },
  };
}

function spawnChild(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
  isWin: boolean,
): ChildProcess {
  const env = sanitizeEnvironment(process.env, options.env);
  return options.ipc
    ? nodeSpawn(command, [...args], {
        cwd: options.cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })
    : (isWin ? crossSpawn : nodeSpawn)(command, [...args], {
        cwd: options.cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
}

type Exit = { readonly code: number; readonly spawnError?: string | undefined };

/** The `code` of a spawn error (`ENOENT`, `ENOEXEC`…), kept for the log and the job's error. */
export function errnoCode(cause: unknown): string {
  return cause instanceof Error && 'code' in cause && typeof cause.code === 'string'
    ? cause.code
    : 'UNKNOWN';
}

function setupExitPromise(child: ChildProcess, cancelTimeout: () => void): Promise<Exit> {
  let spawnFailed = false;
  return new Promise<Exit>((resolve) => {
    child.on('error', (cause) => {
      spawnFailed = true;
      cancelTimeout();
      resolve({ code: 127, spawnError: errnoCode(cause) });
    });
    child.on('close', (code) => {
      cancelTimeout();
      if (!spawnFailed) resolve({ code: code ?? 1 });
    });
  });
}

function createProcessHandle(
  child: ChildProcess,
  buffer: ReturnType<typeof setupOutputBuffer>,
  options: SpawnOptions,
  isWin: boolean,
): ChildProcessHandle {
  let timeoutTimer: NodeJS.Timeout | undefined;
  let timedOut = false;
  const cancelTimeout = () => {
    if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
  };

  const exitPromise = setupExitPromise(child, cancelTimeout);

  if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      void killProcessTree(child.pid, isWin);
    }, options.timeoutMs);
  }

  return {
    pid: child.pid,
    onLine(cb) {
      buffer.addListener(cb);
    },
    send(message: unknown): boolean {
      return typeof child.send === 'function' ? child.send(message as Serializable) : false;
    },
    onMessage(cb: (message: unknown) => void) {
      child.on('message', cb);
    },
    async wait(): Promise<ProcessOutput> {
      const exit = await exitPromise;
      return {
        exitCode: timedOut ? 124 : exit.code,
        spawnError: exit.spawnError,
        stdout: buffer.getStdout(),
        stderr: buffer.getStderr(),
        lines: [...buffer.lines],
      };
    },
    async kill(): Promise<void> {
      cancelTimeout();
      await killProcessTree(child.pid, isWin);
    },
  };
}

/** A command that never started: it ends at once with 127, like a shell, and says why. */
function failedHandle(spawnError: string): ChildProcessHandle {
  const output: ProcessOutput = { exitCode: 127, stdout: '', stderr: '', lines: [], spawnError };
  return {
    onLine: () => undefined,
    wait: () => Promise.resolve(output),
    kill: () => Promise.resolve(),
  };
}

type Started =
  | { readonly kind: 'child'; readonly child: ChildProcess }
  | { readonly kind: 'failed'; readonly spawnError: string };

/**
 * Node throws (not emits) ENOEXEC for a file without `#!`, as pnpm 12 leaves `pnpm` when its
 * install script did not run. A shell runs such a file as a script, so the Terminal works; the
 * same command goes once more through `/bin/sh`, the arguments passed apart, never joined.
 */
function startChild(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
  isWin: boolean,
): Started {
  try {
    return { kind: 'child', child: spawnChild(command, args, options, isWin) };
  } catch (cause) {
    const spawnError = errnoCode(cause);
    if (isWin || spawnError !== 'ENOEXEC') return { kind: 'failed', spawnError };
    try {
      const viaShell = ['-c', '"$0" "$@"', command, ...args];
      return { kind: 'child', child: spawnChild('/bin/sh', viaShell, options, isWin) };
    } catch (again) {
      return { kind: 'failed', spawnError: errnoCode(again) };
    }
  }
}

export function createNodeProcess(): ProcessPort {
  return {
    spawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcessHandle {
      const isWin = process.platform === 'win32';
      const started = startChild(command, args, options, isWin);
      if (started.kind === 'failed') return failedHandle(started.spawnError);
      const buffer = setupOutputBuffer(started.child);
      return createProcessHandle(started.child, buffer, options, isWin);
    },
  };
}
