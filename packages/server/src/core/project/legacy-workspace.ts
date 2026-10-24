// Projects opened before the app was renamed (ReactCraft → KumiCraft) keep their workspace.
import { ok, type Result, WORKSPACE_DIR } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

/** The workspace folder of a project opened under the old name. */
export const LEGACY_WORKSPACE_DIR = '.reactcraft';

/**
 * Renames `.reactcraft` to `.kumicraft` once, so the project keeps its id, frames and settings.
 * Nothing happens when the project already has `.kumicraft` or never had the old folder.
 */
export async function moveLegacyWorkspace(fs: FileSystemPort, root: string): Promise<Result<void>> {
  if (await fs.exists(root, WORKSPACE_DIR)) return ok(undefined);
  if (!(await fs.exists(root, LEGACY_WORKSPACE_DIR))) return ok(undefined);
  return fs.rename(root, LEGACY_WORKSPACE_DIR, WORKSPACE_DIR);
}
