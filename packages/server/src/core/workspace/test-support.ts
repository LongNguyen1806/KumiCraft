// Helpers shared by the workspace tests. Not used by production code.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { ok } from '../shared/result.ts';
import { toSupportedPlatform } from '../shared/session.ts';

export const platform = toSupportedPlatform(process.platform) ?? 'linux';
export const nodeFs = createNodeFileSystem(platform);

/**
 * `nodeFs` that writes straight to the file, without the fsync and rename of `writeTextAtomic`.
 * For tests that write hundreds of times (walks over real files): atomic writes there saturate
 * the disk and slow every other test of the run.
 */
export const directWriteFs: FileSystemPort = {
  ...nodeFs,
  writeTextAtomic: async (root, path, content) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content, 'utf8');
    return ok(undefined);
  },
  writeBytesAtomic: async (root, path, bytes) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), bytes);
    return ok(undefined);
  },
};

export const silentLogger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
};

export const NOW = new Date('2026-10-11T08:09:10.123Z');

/**
 * A process on a machine: other processes are alive while their pid is in `alive`, and a port
 * accepts connections while it is in `listening`.
 */
export function fakeSystem(
  pid: number,
  alive: Set<number>,
  hostname = 'MY-PC',
  listening: Set<number> = new Set(),
  now: () => Date = () => NOW,
): SystemPort {
  return {
    pid,
    hostname,
    now,
    isProcessAlive: (other) => alive.has(other),
    isListening: (port) => Promise.resolve(listening.has(port)),
  };
}

export async function makeTempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'reactcraft-ws-'));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/**
 * The smallest folder the vite-react adapter supports (R-PJ-03): package.json with Vite 8, React 19
 * and Tailwind 4, a Vite config and a CSS file importing Tailwind. Dependencies are not installed.
 */
export async function writeSupportedProject(dir: string): Promise<void> {
  await mkdir(join(dir, 'src'), { recursive: true });
  const pkg = {
    name: 'fixture',
    private: true,
    type: 'module',
    dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: { vite: '^8.0.0', tailwindcss: '^4.0.0', '@tailwindcss/vite': '^4.0.0' },
  };
  await writeFile(join(dir, 'package.json'), `${JSON.stringify(pkg, undefined, 2)}\n`);
  await writeFile(join(dir, 'vite.config.ts'), 'export default {};\n');
  await writeFile(join(dir, 'src', 'index.css'), '@import "tailwindcss";\n');
}
