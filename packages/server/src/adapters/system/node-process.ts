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
} from '../../core/ports/process-port.ts';

/** S-53: Strip REACTCRAFT_* env vars. Agent auth tokens (e.g. GH_TOKEN) are preserved. */
export function sanitizeEnvironment(
  baseEnv: NodeJS.ProcessEnv,
  extraEnv?: Readonly<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value === undefined) continue;
    if (key.startsWith('REACTCRAFT_')) continue;
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

function setupExitPromise(child: ChildProcess, cancelTimeout: () => void): Promise<number> {
  let spawnFailed = false;
  return new Promise<number>((resolve) => {
    child.on('error', () => {
      spawnFailed = true;
      cancelTimeout();
      resolve(127);
    });
    child.on('close', (code) => {
      cancelTimeout();
      if (!spawnFailed) resolve(code ?? 1);
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
      const exitCode = await exitPromise;
      return {
        exitCode: timedOut ? 124 : exitCode,
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

export function createNodeProcess(): ProcessPort {
  return {
    spawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcessHandle {
      const isWin = process.platform === 'win32';
      const child = spawnChild(command, args, options, isWin);
      const buffer = setupOutputBuffer(child);
      return createProcessHandle(child, buffer, options, isWin);
    },
  };
}
