// A fake runner child process for RunnerService tests: records what is sent, replays lines,
// IPC messages and the exit.
import type { ChildProcessHandle } from '../../ports/process-port.ts';

export type MockProcessHandle = ChildProcessHandle & {
  triggerLine(line: string): void;
  triggerMessage(msg: unknown): void;
  triggerExit(code?: number): void;
  sentMessages: unknown[];
  killed: boolean;
};

type ExitResult = { exitCode: number; stdout: string; stderr: string; lines: string[] };

export function createMockHandle(): MockProcessHandle {
  const lineListeners: ((line: string) => void)[] = [];
  const messageListeners: ((msg: unknown) => void)[] = [];
  let exitResolver: (val: ExitResult) => void;
  const exitPromise = new Promise<ExitResult>((resolve) => {
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
