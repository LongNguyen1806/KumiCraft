// SystemPort on Node.js.
import { createConnection } from 'node:net';
import { hostname } from 'node:os';

import type { SystemPort } from '../../ports/system-port.ts';

const PROBE_TIMEOUT_MS = 1000;

/** Signal 0 checks a process without touching it: ESRCH means gone, EPERM means alive. */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * A refused connection means nobody listens. A timeout counts as listening: on 127.0.0.1 it means
 * a busy process, and taking the lock of a live server would be worse than a false "busy".
 */
function isListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS, () => {
      finish(true);
    });
    socket.once('connect', () => {
      finish(true);
    });
    socket.once('error', () => {
      finish(false);
    });
  });
}

export function createNodeSystem(): SystemPort {
  return {
    pid: process.pid,
    hostname: hostname(),
    now: () => new Date(),
    isProcessAlive,
    isListening,
  };
}
