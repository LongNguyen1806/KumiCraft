// Session lock of a workspace (R-PJ-19, ADR-BE-03): one server per workspace.
//
// A lock is held only while its server really runs. After a crash or a power cut the lock stays on
// disk, and after a restart its pid may belong to another program. So a lock of this machine is
// stale when its process is gone, or when nothing listens on its port any more (a running server
// always does, a reused pid does not). A lock left empty or broken by a power cut is stale too.
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

export type LockTiming = {
  /** A server starts listening this long after taking the lock at most (R-PJ-19). */
  readonly startupGraceMs: number;
  /** Wait before reading an unreadable lock again: its writer may be between create and write. */
  readonly settleMs: number;
};

const TIMING: LockTiming = { startupGraceMs: 15_000, settleMs: 500 };

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function parseLock(text: string): LockInfo | undefined {
  try {
    const value = JSON.parse(text) as Partial<LockInfo>;
    const isValid =
      typeof value.pid === 'number' &&
      typeof value.hostname === 'string' &&
      typeof value.port === 'number' &&
      typeof value.startedAt === 'string';
    return isValid ? (value as LockInfo) : undefined;
  } catch {
    return undefined;
  }
}

type Holder =
  | { readonly kind: 'gone' }
  | { readonly kind: 'broken' }
  | { readonly kind: 'lock'; readonly info: LockInfo };

async function readHolder(fs: FileSystemPort, root: string): Promise<Holder> {
  const read = await fs.readText(root, LOCK_FILE, { maxBytes: 4096 });
  if (!read.ok) return read.error.code === 'E015' ? { kind: 'gone' } : { kind: 'broken' };
  const info = parseLock(read.value);
  return info === undefined ? { kind: 'broken' } : { kind: 'lock', info };
}

/** Whether the lock belongs to a server that still runs (or may still be starting). */
async function isLive(info: LockInfo, system: SystemPort, timing: LockTiming): Promise<boolean> {
  if (info.hostname !== system.hostname) return true; // R-PJ-19: another machine, never reclaimed
  if (!system.isProcessAlive(info.pid)) return false;
  const age = system.now().getTime() - Date.parse(info.startedAt);
  if (age >= 0 && age < timing.startupGraceMs) return true;
  return system.isListening(info.port);
}

/** Holder after settling: a broken lock gets one more chance to be written by its server. */
async function settledHolder(
  fs: FileSystemPort,
  root: string,
  timing: LockTiming,
): Promise<Holder> {
  const first = await readHolder(fs, root);
  if (first.kind !== 'broken') return first;
  await sleep(timing.settleMs);
  return readHolder(fs, root);
}

const busy = (info?: LockInfo): Result<never> =>
  err({
    code: 'E018',
    params: {
      resource: 'workspace',
      ...(info === undefined ? {} : { port: info.port, pid: info.pid, hostname: info.hostname }),
    },
  });

/**
 * Takes the lock, reclaiming it once when it is stale.
 *
 * @returns The lock written, or E018 with `params.port` of the running session so the user can
 *   open it.
 */
export async function acquireLock(
  fs: FileSystemPort,
  root: string,
  system: SystemPort,
  port: number,
  timing: LockTiming = TIMING,
): Promise<Result<LockInfo>> {
  const mine: LockInfo = {
    pid: system.pid,
    hostname: system.hostname,
    startedAt: system.now().toISOString(),
    port,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const created = await fs.createExclusive(root, LOCK_FILE, `${JSON.stringify(mine)}\n`);
    if (!created.ok) return created;
    if (created.value === 'created') return ok(mine);
    const holder = await settledHolder(fs, root, timing);
    if (holder.kind === 'lock' && (await isLive(holder.info, system, timing))) {
      return busy(holder.info);
    }
    if (attempt > 0) return busy(holder.kind === 'lock' ? holder.info : undefined);
    const removed = await fs.remove(root, LOCK_FILE);
    if (!removed.ok) return removed;
  }
  return busy();
}

/** Removes the lock if it is still the one this server wrote (it may have been reclaimed). */
export async function releaseLock(fs: FileSystemPort, root: string, mine: LockInfo): Promise<void> {
  const holder = await readHolder(fs, root);
  if (holder.kind !== 'lock') return;
  const { info } = holder;
  const isMine =
    info.pid === mine.pid &&
    info.hostname === mine.hostname &&
    info.port === mine.port &&
    info.startedAt === mine.startedAt;
  if (isMine) await fs.remove(root, LOCK_FILE);
}
