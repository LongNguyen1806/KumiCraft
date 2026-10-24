// Port of the last session of a project (SPEC-05 S-02): the CLI tries it first, so the Studio
// opens at the same address and the browser keeps what it remembers for it (panel sizes, R-SH-01).
// Kept in `.kumicraft/cache/`, which never goes to Git.
import { WORKSPACE_DIR } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

export const STUDIO_CACHE_FILE = `${WORKSPACE_DIR}/cache/studio.json`;

/** S-02: only ports of the dynamic range are reused. */
export const isDynamicPort = (port: unknown): port is number =>
  typeof port === 'number' && Number.isInteger(port) && port >= 49152 && port <= 65535;

/** Best effort: a workspace without the file simply gets a random port. */
export async function rememberPort(fs: FileSystemPort, root: string, port: number): Promise<void> {
  if (!isDynamicPort(port)) return;
  await fs.writeTextAtomic(root, STUDIO_CACHE_FILE, `${JSON.stringify({ port })}\n`);
}

export async function readRememberedPort(
  fs: FileSystemPort,
  root: string,
): Promise<number | undefined> {
  const read = await fs.readText(root, STUDIO_CACHE_FILE, { maxBytes: 1024 });
  if (!read.ok) return undefined;
  try {
    const { port } = JSON.parse(read.value) as { port?: unknown };
    return isDynamicPort(port) ? port : undefined;
  } catch {
    return undefined;
  }
}
