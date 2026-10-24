import { type ProjectProbe, type SupportReport, WORKSPACE_FILE } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { checkBlockedPath, checkPathSyntax, parentPath } from '../shared/paths.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { Platform } from '../shared/session.ts';
import { detectFramework } from './frameworks/index.ts';

export const EMPTY_ALLOWED_NAMES = new Set([
  '.git',
  '.gitignore',
  '.gitattributes',
  'README.md',
  'LICENSE',
  '.DS_Store',
  'Thumbs.db',
  '.vscode',
  '.idea',
]);

export type ProbeDeps = {
  readonly fs: FileSystemPort;
  readonly platform: Platform;
  readonly homeDir?: string | undefined;
};

export async function probeProject(path: string, deps: ProbeDeps): Promise<Result<ProjectProbe>> {
  const syntaxError = checkPathSyntax(path, deps.platform);
  if (syntaxError !== undefined) return err(syntaxError);

  const blockedError = checkBlockedPath(path, deps.platform, deps.homeDir);
  if (blockedError !== undefined) return err(blockedError);

  const exists = await deps.fs.exists(path, '.');
  if (!exists) {
    const parent = parentPath(path);
    const canCreate = parent !== undefined ? await deps.fs.exists(parent, '.') : false;
    return ok({ kind: 'missing', canCreate });
  }

  const hasPackageJson = await deps.fs.exists(path, 'package.json');
  if (hasPackageJson) {
    const read = await deps.fs.readText(path, 'package.json', { maxBytes: 1024 * 1024 });
    let packageJson: unknown = {};
    if (read.ok) {
      try {
        packageJson = JSON.parse(read.value);
      } catch {
        packageJson = {};
      }
    }

    const { report } = await detectFramework({
      root: path,
      fs: deps.fs,
      packageJson,
    });

    const hasWorkspace = await deps.fs.exists(path, WORKSPACE_FILE);
    return ok({
      kind: 'project',
      support: report,
      hasWorkspace,
    });
  }

  const entriesResult = await deps.fs.readDir(path, '.');
  if (!entriesResult.ok) return entriesResult;

  const isEmpty = entriesResult.value.every((entry) => EMPTY_ALLOWED_NAMES.has(entry.name));
  return isEmpty ? ok({ kind: 'empty' }) : ok({ kind: 'other' });
}

export async function probeSupportedProject(
  root: string,
  deps: ProbeDeps,
): Promise<Result<SupportReport>> {
  const probed = await probeProject(root, deps);
  if (!probed.ok) return probed;
  if (probed.value.kind !== 'project') {
    return err({ code: 'E001', params: { reasons: ['noPackageJson'] } });
  }
  if (!probed.value.support.supported) {
    return err({ code: 'E001', params: { reasons: probed.value.support.reasons } });
  }
  return ok(probed.value.support);
}
