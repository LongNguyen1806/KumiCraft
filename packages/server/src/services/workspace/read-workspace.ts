// Reading `.kumicraft/workspace.json` (SPEC-03 section 3, V-105, V-106). A broken file is never
// rewritten: the project stays in `error` until the user fixes it.
import {
  parseWorkspaceFile,
  WORKSPACE_FILE,
  WORKSPACE_FILE_MAX_BYTES,
  type WorkspaceFile,
} from '@kumicraft/shared';

import { jsonDepth, MAX_JSON_DEPTH } from '../../kernel/paths.ts';
import { err, type Result } from '../../kernel/result.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

const invalid = (message: string, cause?: unknown) =>
  err({
    code: 'E003',
    params: { file: WORKSPACE_FILE, reason: 'invalid' },
    details: [{ path: WORKSPACE_FILE, message }],
    ...(cause === undefined ? {} : { cause }),
  });

export async function readWorkspaceFile(
  fs: FileSystemPort,
  root: string,
): Promise<Result<WorkspaceFile>> {
  const read = await fs.readText(root, WORKSPACE_FILE, { maxBytes: WORKSPACE_FILE_MAX_BYTES });
  if (!read.ok)
    return err({ ...read.error, params: { ...read.error.params, file: WORKSPACE_FILE } });
  if (jsonDepth(read.value) > MAX_JSON_DEPTH) return invalid('JSON nested too deeply (S-29)');
  let value: unknown;
  try {
    value = JSON.parse(read.value);
  } catch (cause) {
    return invalid('Invalid JSON', cause);
  }
  return parseWorkspaceFile(value);
}
