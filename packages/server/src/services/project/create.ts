// Project scaffolding from template (SPEC-04 R-PJ-10, R-PJ-11).
import { parentPath } from '../../kernel/paths.ts';
import { type AppError, err, ok, type Result } from '../../kernel/result.ts';
import type { Platform } from '../../kernel/session.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { StackTable } from './frameworks/index.ts';
import { probeProject } from './probe.ts';

export type CreateProjectDeps = {
  readonly fs: FileSystemPort;
  readonly platform: Platform;
  readonly templateDir: string;
  readonly homeDir?: string | undefined;
  readonly stacks: StackTable;
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
 * Template filenames that must be renamed in the created project (ADR-BE-32). npm renames a
 * published `.gitignore`, so the template keeps it as `_gitignore`.
 */
const TEMPLATE_RENAMES: Readonly<Record<string, string>> = {
  _gitignore: '.gitignore',
};

async function listTemplateFiles(
  fs: FileSystemPort,
  templateDir: string,
  dir = '',
): Promise<Result<readonly (readonly [string, string])[]>> {
  const entries = await fs.readDir(templateDir, dir === '' ? '.' : dir);
  if (!entries.ok) return entries;

  const files: (readonly [string, string])[] = [];
  for (const entry of entries.value) {
    const templatePath = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      const sub = await listTemplateFiles(fs, templateDir, templatePath);
      if (!sub.ok) return sub;
      files.push(...sub.value);
    } else {
      const targetName = TEMPLATE_RENAMES[entry.name] ?? entry.name;
      const targetPath = dir === '' ? targetName : `${dir}/${targetName}`;
      files.push([templatePath, targetPath]);
    }
  }
  files.sort((a, b) => a[0].localeCompare(b[0]));
  return ok(files);
}

export async function createProject(
  targetPath: string,
  name: string,
  deps: CreateProjectDeps,
): Promise<Result<void>> {
  const probe = await probeProject(targetPath, {
    fs: deps.fs,
    platform: deps.platform,
    homeDir: deps.homeDir,
    stacks: deps.stacks,
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
  const listed = await listTemplateFiles(deps.fs, deps.templateDir);
  if (!listed.ok) return { ok: false, error: { created, cause: listed.error } };

  for (const [templatePath, relPath] of listed.value) {
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
