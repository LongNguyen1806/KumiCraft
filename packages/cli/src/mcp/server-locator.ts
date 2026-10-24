// Finds the KumiCraft server an MCP session talks to (R-AG-19): its port from the lock KumiCraft
// keeps in the project it has open, its token from the session file in the user's config folder.
// Read only.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LOCK_FILE, parseLock, parseSessionToken, SESSION_FILE } from '@kumicraft/server';

import type { McpOptions } from '../args.ts';

export type ServerAddress = { readonly port: number; readonly token: string };

export type LocateDeps = {
  /** The user's config folder (KUMICRAFT_CONFIG_DIR or env-paths), where `session.json` lives. */
  readonly configDir: string;
  readonly readText?: ((path: string) => Promise<string | undefined>) | undefined;
  readonly now?: (() => Date) | undefined;
};

async function readTextFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

/** The server that has the project open, or undefined when none has. */
export async function locateServer(
  options: McpOptions,
  deps: LocateDeps,
): Promise<ServerAddress | undefined> {
  const read = deps.readText ?? readTextFile;
  const lockText = await read(join(options.projectDir, LOCK_FILE));
  const port = options.port ?? (lockText === undefined ? undefined : parseLock(lockText)?.port);
  if (port === undefined) return undefined;
  const sessionText = await read(join(deps.configDir, SESSION_FILE));
  const now = deps.now?.() ?? new Date();
  const token = sessionText === undefined ? undefined : parseSessionToken(sessionText, now);
  return token === undefined ? undefined : { port, token };
}
