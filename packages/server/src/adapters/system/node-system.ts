// SystemPort on Node.js.
import { hostname } from 'node:os';

import type { SystemPort } from '../../core/ports/system-port.ts';

/** Signal 0 checks a process without touching it: ESRCH means gone, EPERM means alive. */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function createNodeSystem(): SystemPort {
  return { pid: process.pid, hostname: hostname(), now: () => new Date(), isProcessAlive };
}
