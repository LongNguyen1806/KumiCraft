// Helpers shared by the workspace tests. Not used by production code.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { toSupportedPlatform } from '../shared/session.ts';

export const platform = toSupportedPlatform(process.platform) ?? 'linux';
export const nodeFs = createNodeFileSystem(platform);

export const silentLogger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
};

export const NOW = new Date('2026-10-11T08:09:10.123Z');

/** Another process on a machine, alive while its pid is in `alive`. */
export function fakeSystem(pid: number, alive: Set<number>, hostname = 'MY-PC'): SystemPort {
  return { pid, hostname, now: () => NOW, isProcessAlive: (other) => alive.has(other) };
}

/** Deterministic ids: `id0000001`… padded to the requested size. */
export function sequenceIds(): (size: number) => string {
  let counter = 0;
  return (size) => String(++counter).padStart(size, '0');
}

export async function makeTempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'reactcraft-ws-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
