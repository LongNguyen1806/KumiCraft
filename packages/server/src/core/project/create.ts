// Project scaffolding from template (SPEC-04 R-PJ-10, R-PJ-11).
import type { PackageManager } from '@reactcraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { parentPath } from '../shared/paths.ts';
import { type AppError, err, ok, type Result } from '../shared/result.ts';
import type { Platform } from '../shared/session.ts';
import { probeProject } from './probe.ts';

export type CreateProjectDeps = {
  readonly fs: FileSystemPort;
  readonly platform: Platform;
  readonly templateDir: string;
  readonly homeDir?: string | undefined;
};

/**
 * Normalizes user-facing project name to a valid npm package name (R-PJ-11).
 * Vietnamese accents stripped, non [a-z0-9-] replaced with '-', max 214 chars, fallback 'app'.
 */
export function toPackageName(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'd')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 214);
  return normalized.length > 0 ? normalized : 'app';
}

/** Last segment of a path written with either separator. */
const lastSegment = (path: string): string =>
  path.replaceAll('\\', '/').replace(/\/+$/, '').split('/').pop() ?? '';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Files of the template (ADR-BE-32), as `[file in the template, file in the new project]`. npm
 * renames a published `.gitignore`, so the template keeps it as `_gitignore`.
 */
const TEMPLATE_FILES: readonly (readonly [string, string])[] = [
  ['package.json', 'package.json'],
  ['index.html', 'index.html'],
  ['vite.config.ts', 'vite.config.ts'],
  ['tsconfig.json', 'tsconfig.json'],
  ['_gitignore', '.gitignore'],
  ['src/index.css', 'src/index.css'],
  ['src/main.tsx', 'src/main.tsx'],
  ['src/routes.tsx', 'src/routes.tsx'],
  ['src/pages/Home.tsx', 'src/pages/Home.tsx'],
  ['src/api/.gitkeep', 'src/api/.gitkeep'],
  ['.reactcraft/agent-guide.md', '.reactcraft/agent-guide.md'],
];

export async function createProject(
  targetPath: string,
  name: string,
  _packageManager: PackageManager | undefined,
  deps: CreateProjectDeps,
): Promise<Result<void>> {
  const probe = await probeProject(targetPath, {
    fs: deps.fs,
    platform: deps.platform,
    homeDir: deps.homeDir,
  });

  if (!probe.ok) return probe;

  const validTarget =
    (probe.value.kind === 'missing' && probe.value.canCreate) || probe.value.kind === 'empty';

  if (!validTarget) {
    return err({ code: 'E016', params: { reason: 'notEmpty' } });
  }

  // The file system port writes under an existing root: a folder still to be made is written
  // through its parent, and removed as a whole if the copy fails.
  const isMissing = probe.value.kind === 'missing';
  const parent = parentPath(targetPath);
  if (isMissing && parent === undefined) {
    return err({ code: 'E012', params: { path: targetPath } });
  }
  const target: WriteTarget =
    isMissing && parent !== undefined
      ? { root: parent, prefix: `${lastSegment(targetPath)}/`, isNew: true }
      : { root: targetPath, prefix: '', isNew: false };

  const copied = await copyTemplate(target, name, deps);
  if (copied.ok) return ok(undefined);

  if (target.isNew) {
    await deps.fs.remove(target.root, target.prefix.slice(0, -1));
  } else {
    for (const file of copied.error.created) await deps.fs.remove(target.root, file);
  }
  return err({
    code: 'E011',
    params: { path: targetPath, operation: 'create' },
    cause: copied.error.cause,
  });
}

type WriteTarget = { readonly root: string; readonly prefix: string; readonly isNew: boolean };
type CopyFailure = { readonly created: readonly string[]; readonly cause: AppError };

/** Copies every template file that is not there yet (R-PJ-10), filling the placeholders. */
async function copyTemplate(
  target: WriteTarget,
  name: string,
  deps: CreateProjectDeps,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: CopyFailure }> {
  const created: string[] = [];
  for (const [templatePath, relPath] of TEMPLATE_FILES) {
    const file = `${target.prefix}${relPath}`;
    if (!target.isNew && (await deps.fs.exists(target.root, file))) continue;

    const read = await deps.fs.readText(deps.templateDir, templatePath);
    if (!read.ok) return { ok: false, error: { created, cause: read.error } };
    const content = fillPlaceholders(relPath, read.value, name);
    const write = await deps.fs.writeTextAtomic(target.root, file, content);
    if (!write.ok) return { ok: false, error: { created, cause: write.error } };
    created.push(file);
  }
  return { ok: true };
}

function fillPlaceholders(relPath: string, content: string, name: string): string {
  if (relPath === 'package.json') return content.replaceAll('{{packageName}}', toPackageName(name));
  if (relPath === 'index.html') return content.replaceAll('{{title}}', escapeHtml(name));
  return content;
}
