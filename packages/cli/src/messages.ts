// Terminal messages of the CLI for failures the user can act on.
import { join } from 'node:path';

import type { AppError } from '@reactcraft/server';

/**
 * Why the server did not start, and what to do. E018 names the running session, or the lock file
 * to delete when that session is on another machine or no longer answers (SPEC-03 section 3, E018).
 */
export function startFailureMessage(error: AppError, workspaceDir: string): string {
  if (error.code !== 'E018') {
    return `could not start the server (${error.code}, ${JSON.stringify(error.params ?? {})}).`;
  }
  const params = error.params ?? {};
  const lock = join(workspaceDir, '.reactcraft', 'lock');
  const lines = ['this project is already open in another ReactCraft session.'];
  if (typeof params['port'] === 'number') {
    const where = typeof params['hostname'] === 'string' ? ` on ${params['hostname']}` : '';
    lines.push(`  It runs${where} at http://127.0.0.1:${String(params['port'])}`);
  }
  lines.push(`  If no other ReactCraft is running, delete ${lock} and try again.`);
  return lines.join('\n');
}
