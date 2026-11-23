// The stamped copy of an ASP.NET project (docs/architecture/03c section 2.4), in
// `<project>/obj/kumicraft/shadow`: every file copied, every .cshtml stamped with `data-rc-loc`.
// `dotnet watch` runs the copy; the user's files are only read.
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { readRazorMarkup } from '../../lib/razor/markup.ts';
import { stampRazor } from '../../lib/razor/stamp.ts';
import type { RazorHelper } from './helper.ts';

export const SHADOW_DIR = join('obj', 'kumicraft', 'shadow');
const SKIP = new Set(['bin', 'obj', 'node_modules', '.git', '.vs', '.kumicraft', '.idea']);
const BOM = '\uFEFF';

/** Whether a project file belongs in the copy (build output and tool folders do not). */
export function isShadowed(rel: string): boolean {
  return !rel.split(/[\\/]/).some((part) => SKIP.has(part));
}

/**
 * A relative path in an MSBuild file (`..\Core\Core.csproj`) made absolute: the copy sits three
 * folders deeper than the project, so the same relative path would point elsewhere.
 */
export function absoluteMsbuildPaths(xml: string, projectDir: string): string {
  return xml.replace(
    /\b(Include|Project|Update)="(\.\.[\\/][^"]*)"/g,
    (_m, attr: string, path: string) => {
      const full = resolve(projectDir, path.replaceAll('\\', sep));
      return `${attr}="${full}"`;
    },
  );
}

async function stampFile(helper: RazorHelper, rel: string, raw: string): Promise<string> {
  const bom = raw.startsWith(BOM);
  const text = bom ? raw.slice(1) : raw;
  const code = await helper.codeRanges(rel, text);
  return (bom ? BOM : '') + stampRazor(readRazorMarkup(text, code), rel);
}

/** What is at a project path now: a file, a folder, or nothing (removed). */
async function kindOf(path: string): Promise<'file' | 'directory' | 'missing'> {
  try {
    const info = await stat(path);
    return info.isDirectory() ? 'directory' : 'file';
  } catch {
    return 'missing';
  }
}

/**
 * Copies (and stamps) one changed project path into the copy. A folder is made (its files come as
 * their own changes); a path gone from the project is removed from the copy.
 */
export async function syncShadowFile(
  root: string,
  rel: string,
  helper: RazorHelper,
): Promise<void> {
  const from = join(root, rel);
  const to = join(root, SHADOW_DIR, rel);
  const kind = await kindOf(from);
  if (kind === 'missing') {
    await rm(to, { recursive: true, force: true });
    return;
  }
  await mkdir(kind === 'directory' ? to : dirname(to), { recursive: true });
  if (kind === 'directory') return;
  if (!rel.endsWith('.cshtml') && !/\.(cs|vb|fs)proj$|\.props$|\.targets$/.test(rel)) {
    await copyFile(from, to);
    return;
  }
  const raw = await readFile(from, 'utf8');
  if (rel.endsWith('.cshtml')) {
    try {
      await writeFile(to, await stampFile(helper, rel.replaceAll('\\', '/'), raw));
    } catch {
      // Razor the compiler cannot read yet (typing in progress): the copy runs it unstamped.
      await writeFile(to, raw);
    }
  } else await writeFile(to, absoluteMsbuildPaths(raw, root));
}

async function listFiles(root: string, dir: string): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;
      if (!isShadowed(rel)) return [];
      if (entry.isDirectory()) return listFiles(root, rel);
      return entry.isFile() ? [rel] : [];
    }),
  );
  return nested.flat();
}

/** Makes the whole copy afresh (files left from an older copy are removed first). */
export async function createShadow(root: string, helper: RazorHelper): Promise<string> {
  const shadow = join(root, SHADOW_DIR);
  // Keep the copy's own bin/ and obj/: dotnet builds faster on the next opening.
  for (const entry of await readdir(shadow, { withFileTypes: true }).catch(() => [])) {
    if (entry.name !== 'bin' && entry.name !== 'obj') {
      await rm(join(shadow, entry.name), { recursive: true, force: true });
    }
  }
  for (const rel of await listFiles(root, '')) await syncShadowFile(root, rel, helper);
  return shadow;
}

/** The project-relative path of a changed file, or undefined for one the copy ignores. */
export function shadowRel(root: string, changed: string): string | undefined {
  const rel = (isAbsolute(changed) ? relative(root, changed) : changed).replaceAll('\\', '/');
  if (rel.startsWith('..') || rel === '' || !isShadowed(rel)) return undefined;
  return rel;
}
