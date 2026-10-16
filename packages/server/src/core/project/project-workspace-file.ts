// Workspace file loading and creation helpers (M-PJ).
import {
  newWorkspaceFile,
  serializeWorkspaceFile,
  type SupportReport,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@reactcraft/shared';
import { nanoid } from 'nanoid';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { ok, type Result } from '../shared/result.ts';
import { readWorkspaceFile } from '../workspace/read-workspace.ts';
import { detectResponsiveMode } from './detect-responsive.ts';

export type WorkspaceFileDeps = {
  readonly fs: FileSystemPort;
  readonly system: SystemPort;
};

export async function loadOrCreateWorkspaceFile(
  deps: WorkspaceFileDeps,
  root: string,
  support: SupportReport,
): Promise<Result<WorkspaceFile>> {
  if (await deps.fs.exists(root, WORKSPACE_FILE)) {
    return readWorkspaceFile(deps.fs, root);
  }
  const folderName = root.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? 'project';
  const truncatedName = folderName.slice(0, 64);
  const responsiveMode = await detectResponsiveMode(deps.fs, root, 'src');

  const file = newWorkspaceFile({
    id: nanoid(10),
    name: truncatedName,
    createdAt: deps.system.now().toISOString(),
    responsiveMode,
    framework: support.framework ?? 'vite-react',
  });

  const write = await deps.fs.writeTextAtomic(root, WORKSPACE_FILE, serializeWorkspaceFile(file));
  if (!write.ok) return write;
  await deps.fs.writeTextAtomic(root, '.reactcraft/.gitignore', 'lock\ncache/\n');
  return ok(file);
}
