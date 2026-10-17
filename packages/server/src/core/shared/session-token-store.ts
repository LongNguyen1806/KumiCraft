// Session token kept between runs (SPEC-05 S-05a): running ReactCraft again keeps the token, so a
// Studio tab still open reconnects on its own. Kept in the user's config folder, never the project.
import { nanoid } from 'nanoid';
import { z } from 'zod';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';

export const SESSION_FILE = 'session.json';
/** S-05a: a token older than this is replaced. */
export const SESSION_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const StoredSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  createdAt: z.iso.datetime(),
});

export type SessionTokenDeps = {
  readonly fs: FileSystemPort;
  /** The user's config folder (env-paths, or REACTCRAFT_CONFIG_DIR). */
  readonly dir: string;
  readonly logger: LoggerPort;
  readonly now?: () => Date;
};

async function readStored(deps: SessionTokenDeps, now: Date): Promise<string | undefined> {
  const read = await deps.fs.readText(deps.dir, SESSION_FILE, { maxBytes: 1024 });
  if (!read.ok) return undefined;
  try {
    const stored = StoredSchema.parse(JSON.parse(read.value));
    const age = now.getTime() - Date.parse(stored.createdAt);
    return age >= 0 && age < SESSION_TOKEN_MAX_AGE_MS ? stored.token : undefined;
  } catch {
    return undefined; // broken file: a new token replaces it
  }
}

/** The saved token while it is fresh, else a new one (saved with mode 0600). */
export async function loadSessionToken(deps: SessionTokenDeps): Promise<string> {
  const now = deps.now?.() ?? new Date();
  const saved = await readStored(deps, now);
  if (saved !== undefined) return saved;

  // 43 characters of a 64-letter alphabet: 258 random bits, like 32 bytes in base64url.
  const token = nanoid(43);
  const text = `${JSON.stringify({ token, createdAt: now.toISOString() }, undefined, 2)}\n`;
  const written = await deps.fs.writeTextAtomic(deps.dir, SESSION_FILE, text, { mode: 0o600 });
  if (!written.ok) {
    // Still works for this run; an open tab just cannot reconnect after the next one.
    deps.logger.warn(
      { file: SESSION_FILE, code: written.error.code },
      'cannot save the session token',
    );
  }
  return token;
}
