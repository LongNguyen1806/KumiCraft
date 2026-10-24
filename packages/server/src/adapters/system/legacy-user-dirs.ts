// User folders from before the app was renamed (ReactCraft → KumiCraft): config, data, cache.
import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { LoggerPort } from '../../core/ports/logger-port.ts';

export type LegacyDirPair = { readonly from: string; readonly to: string };

/**
 * Moves each old folder to its new place once, so the recent projects, trusted projects and
 * settings survive the rename. A folder already at the new place is never overwritten.
 */
export async function moveLegacyUserDirs(
  pairs: readonly LegacyDirPair[],
  logger: LoggerPort,
): Promise<void> {
  for (const { from, to } of pairs) {
    if (from === to || existsSync(to) || !existsSync(from)) continue;
    try {
      await mkdir(dirname(to), { recursive: true });
      await rename(from, to);
      logger.info({ from, to }, 'moved the folder of the old app name');
    } catch (cause) {
      logger.warn({ from, to, err: cause }, 'cannot move the folder of the old app name');
    }
  }
}
