import { type ProjectProbe, type SupportReport, WORKSPACE_FILE } from '@kumicraft/shared';

import { checkBlockedPath, checkPathSyntax, parentPath } from '../../kernel/paths.ts';
import { err, ok, type Result } from '../../kernel/result.ts';
import type { Platform } from '../../kernel/session.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { findAppCandidates } from './app-candidates.ts';
import { detectStack, type ProjectStack, type StackTable } from './frameworks/index.ts';

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
  /** The combination table of the stacks KumiCraft runs (docs/architecture/03 section 3.4). */
  readonly stacks: StackTable;
};

function hasWorkspacesField(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('workspaces' in value)) return false;
  const ws = (value as { readonly workspaces?: unknown }).workspaces;
  return Array.isArray(ws) || (typeof ws === 'object' && Boolean(ws));
}

async function probePackageJsonProject(
  path: string,
  deps: ProbeDeps,
): Promise<Result<ProjectProbe>> {
  const read = await deps.fs.readText(path, 'package.json', { maxBytes: 1024 * 1024 });
  let packageJson: unknown = {};
  if (read.ok) {
    try {
      packageJson = JSON.parse(read.value);
    } catch {
      packageJson = {};
    }
  }

  const { report } = await detectStack({ root: path, fs: deps.fs, packageJson }, deps.stacks);
  const hasWorkspace = await deps.fs.exists(path, WORKSPACE_FILE);
  if (report.supported) {
    return ok({ kind: 'project', support: report, hasWorkspace });
  }

  const isWorkspace =
    hasWorkspacesField(packageJson) || (await deps.fs.exists(path, 'pnpm-workspace.yaml'));
  if (isWorkspace) {
    const candidates = await findAppCandidates(path, deps.fs, deps.stacks);
    if (candidates.length > 0) {
      return ok({ kind: 'apps', apps: candidates });
    }
  }

  return ok({ kind: 'project', support: report, hasWorkspace });
}

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
    return probePackageJsonProject(path, deps);
  }

  const entriesResult = await deps.fs.readDir(path, '.');
  if (!entriesResult.ok) return entriesResult;

  const isEmpty = entriesResult.value.every((entry) => EMPTY_ALLOWED_NAMES.has(entry.name));
  if (isEmpty) return ok({ kind: 'empty' });

  const candidates = await findAppCandidates(path, deps.fs, deps.stacks);
  if (candidates.length > 0) {
    return ok({ kind: 'apps', apps: candidates });
  }

  return ok({ kind: 'other' });
}

export async function probeSupportedProject(
  root: string,
  deps: ProbeDeps,
): Promise<Result<{ readonly report: SupportReport; readonly stack: ProjectStack }>> {
  const probed = await probeProject(root, deps);
  if (!probed.ok) return probed;
  if (probed.value.kind !== 'project') {
    return err({ code: 'E001', params: { reasons: ['noPackageJson'] } });
  }
  if (!probed.value.support.supported) {
    return err({ code: 'E001', params: { reasons: probed.value.support.reasons } });
  }
  const read = await deps.fs.readText(root, 'package.json', { maxBytes: 1024 * 1024 });
  let packageJson: unknown = {};
  if (read.ok) {
    try {
      packageJson = JSON.parse(read.value);
    } catch {
      packageJson = {};
    }
  }
  const { stack } = await detectStack({ root, fs: deps.fs, packageJson }, deps.stacks);
  return ok({ report: probed.value.support, stack });
}
