// Session lock of a workspace (SPEC-04.1 section 2.2, ADR-BE-03 rule 4): one server per workspace.
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { err, ok, type Result } from '../shared/result.ts';

export const LOCK_FILE = '.reactcraft/lock';

export type LockInfo = {
  readonly pid: number;
  readonly hostname: string;
  readonly startedAt: string;
  readonly port: number;
};

async function readLock(fs: FileSystemPort, root: string): Promise<LockInfo | undefined> {
  const read = await fs.readText(root, LOCK_FILE, { maxBytes: 4096 });
  if (!read.ok) return undefined;
  try {
    const value = JSON.parse(read.value) as Partial<LockInfo>;
    return typeof value.pid === 'number' && typeof value.hostname === 'string'
      ? (value as LockInfo)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Takes the lock, reclaiming it once when the holder is a dead process of this machine.
 *
 * @returns ok, or E018 with `params.port` of the running session so the user can open it.
 */
export async function acquireLock(
  fs: FileSystemPort,
  root: string,
  system: SystemPort,
  port: number,
): Promise<Result<void>> {
  const info: LockInfo = {
    pid: system.pid,
    hostname: system.hostname,
    startedAt: system.now().toISOString(),
    port,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const created = await fs.createExclusive(root, LOCK_FILE, `${JSON.stringify(info)}\n`);
    if (!created.ok) return created;
    if (created.value === 'created') return ok(undefined);
    const holder = await readLock(fs, root);
    const isStale =
      holder !== undefined &&
      holder.hostname === system.hostname &&
      !system.isProcessAlive(holder.pid);
    if (!isStale || attempt > 0) {
      return err({
        code: 'E018',
        params: {
          resource: 'workspace',
          ...(holder === undefined ? {} : { port: holder.port, pid: holder.pid }),
        },
      });
    }
    const removed = await fs.remove(root, LOCK_FILE);
    if (!removed.ok) return removed;
  }
  return err({ code: 'E018', params: { resource: 'workspace' } });
}

/** Removes the lock if it is still ours (another server may have reclaimed a stale one). */
export async function releaseLock(
  fs: FileSystemPort,
  root: string,
  system: SystemPort,
): Promise<void> {
  const holder = await readLock(fs, root);
  if (holder?.pid === system.pid && holder.hostname === system.hostname)
    await fs.remove(root, LOCK_FILE);
}
