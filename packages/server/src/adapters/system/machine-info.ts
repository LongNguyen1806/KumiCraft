// What a bug report needs about the computer (owner, 2026-11-21): written to the log file only,
// never shown. A user's home folder is written as `~`, so no user name reaches the log.
import { open, stat } from 'node:fs/promises';
import { arch, cpus, homedir, platform, release, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import type { PackageManager } from '@kumicraft/shared';

import type { LoggerPort } from '../../ports/logger-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';

const PROBED = ['pnpm', 'npm', 'yarn', 'bun'] as const;
/** The order a project without a lock file falls back to (the create dialog's order). */
const FALLBACK: readonly PackageManager[] = ['pnpm', 'npm', 'yarn'];

export type ManagerProbe = {
  readonly version?: string | undefined;
  readonly exitCode?: number | undefined;
  readonly spawnError?: string | undefined;
  /** POSIX only: where the command is, and whether it is a program or a script. */
  readonly path?: string | undefined;
  readonly file?: 'binary' | 'script' | 'textWithoutShebang' | undefined;
};

export type MachineInfo = Readonly<Record<(typeof PROBED)[number], ManagerProbe>>;

async function probeVersion(processPort: ProcessPort, name: string): Promise<ManagerProbe> {
  const handle = processPort.spawn(name, ['--version'], { cwd: tmpdir(), timeoutMs: 15_000 });
  const out = await handle.wait();
  if (out.exitCode === 0)
    return { version: (out.stdout.split(/\r?\n/)[0] ?? '').trim().slice(0, 40) };
  return { exitCode: out.exitCode, spawnError: out.spawnError };
}

async function findOnPath(name: string): Promise<string | undefined> {
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (dir === '') continue;
    const candidate = join(dir, name);
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // not in this folder
    }
  }
  return undefined;
}

const MACHO = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe]);

/** pnpm 12 leaves `pnpm` a script without `#!` until its install script replaces it. */
export function fileKindOf(head: Uint8Array): ManagerProbe['file'] {
  if (head[0] === 0x23 && head[1] === 0x21) return 'script';
  const word = head.length < 4 ? 0 : new DataView(head.buffer, head.byteOffset).getUint32(0);
  const elf = head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46;
  return elf || MACHO.has(word) ? 'binary' : 'textWithoutShebang';
}

async function fileKind(path: string): Promise<ManagerProbe['file']> {
  const handle = await open(path, 'r');
  try {
    const head = new Uint8Array(4);
    await handle.read(head, 0, 4, 0);
    return fileKindOf(head);
  } finally {
    await handle.close();
  }
}

export function withoutHome(path: string, home = homedir()): string {
  return home !== '' && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

async function probeManager(processPort: ProcessPort, name: string): Promise<ManagerProbe> {
  try {
    const version = await probeVersion(processPort, name);
    if (platform() === 'win32') return version;
    const path = await findOnPath(name);
    if (path === undefined) return version;
    return { ...version, path: withoutHome(path), file: await fileKind(path) };
  } catch (cause) {
    return { spawnError: cause instanceof Error ? cause.message.slice(0, 200) : 'UNKNOWN' };
  }
}

export async function probeMachine(processPort: ProcessPort): Promise<MachineInfo> {
  const [pnpm, npm, yarn, bun] = await Promise.all(PROBED.map((n) => probeManager(processPort, n)));
  return { pnpm: pnpm ?? {}, npm: npm ?? {}, yarn: yarn ?? {}, bun: bun ?? {} };
}

/** The first package manager that answered `--version`. */
export function installedOf(info: MachineInfo): PackageManager | undefined {
  return FALLBACK.find((name) => info[name].version !== undefined);
}

/**
 * Probes once in the background and logs one `machine` line; the returned function waits for the
 * probe and gives the package manager a project without a lock file falls back to.
 */
export function startMachineProbe(
  processPort: ProcessPort,
  logger: LoggerPort,
  kumicraftVersion: string,
): () => Promise<PackageManager | undefined> {
  const probing = (async () => {
    const packageManagers = await probeMachine(processPort);
    logger.info(
      {
        os: platform(),
        osRelease: release(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        node: process.version,
        kumicraft: kumicraftVersion,
        packageManagers,
      },
      'machine',
    );
    return packageManagers;
  })();
  return async () => installedOf(await probing);
}
