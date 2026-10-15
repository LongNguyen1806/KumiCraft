import { execFile, type Serializable, spawn as nodeSpawn } from 'node:child_process';
import { createInterface } from 'node:readline';

import crossSpawn from 'cross-spawn';

import type {
  ChildProcessHandle,
  ProcessOutput,
  ProcessPort,
  SpawnOptions,
} from '../../core/ports/process-port.ts';

/** S-53: Strip REACTCRAFT_* and session token env vars. */
export function sanitizeEnvironment(
  baseEnv: NodeJS.ProcessEnv,
  extraEnv?: Readonly<Record<string, string>>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value === undefined) continue;
    if (key.startsWith('REACTCRAFT_') || key.toLowerCase().includes('token')) continue;
    result[key] = value;
  }
  if (extraEnv !== undefined) {
    for (const [key, value] of Object.entries(extraEnv)) {
      result[key] = value;
    }
  }
  return result;
}

export function createNodeProcess(): ProcessPort {
  return {
    spawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcessHandle {
      const isWin = process.platform === 'win32';
      const env = sanitizeEnvironment(process.env, options.env);

      // S-51: Fixed argument array, no shell; on Windows use cross-spawn to resolve batch files
      // If IPC is requested, nodeSpawn is used with an 'ipc' channel (R-RN-02)
      const stdio = options.ipc
        ? (['ignore', 'pipe', 'pipe', 'ipc'] as const)
        : (['ignore', 'pipe', 'pipe'] as const);
      const spawnFn = options.ipc ? nodeSpawn : isWin ? crossSpawn : nodeSpawn;
      const child = spawnFn(command, [...args], {
        cwd: options.cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: stdio as unknown as ['ignore', 'pipe', 'pipe'],
      });

      const lines: string[] = [];
      const listeners: ((line: string) => void)[] = [];

      let stdoutAccum = '';
      let stderrAccum = '';

      const handleLine = (line: string) => {
        lines.push(line);
        if (lines.length > 500) {
          lines.shift();
        }
        for (const cb of listeners) {
          cb(line);
        }
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

      let timeoutTimer: NodeJS.Timeout | undefined;
      let timedOut = false;
      let spawnFailed = false;

      const exitPromise = new Promise<number>((resolve) => {
        child.on('error', () => {
          spawnFailed = true;
          if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
          resolve(127); // Command not found / failed to spawn
        });
        child.on('close', (code) => {
          if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
          if (!spawnFailed) {
            resolve(code ?? 1);
          }
        });
      });

      if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          void killProcessTree(child.pid);
        }, options.timeoutMs);
      }

      async function killProcessTree(pid?: number): Promise<void> {
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

      return {
        pid: child.pid,
        onLine(cb) {
          listeners.push(cb);
        },
        send(message: unknown): boolean {
          if (typeof child.send === 'function') {
            return child.send(message as Serializable);
          }
          return false;
        },
        onMessage(cb: (message: unknown) => void) {
          child.on('message', cb);
        },
        async wait(): Promise<ProcessOutput> {
          const exitCode = await exitPromise;
          return {
            exitCode: timedOut ? 124 : exitCode,
            stdout: stdoutAccum,
            stderr: stderrAccum,
            lines: [...lines],
          };
        },
        async kill(): Promise<void> {
          if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
          await killProcessTree(child.pid);
        },
      };
    },
  };
}
