// Shared `@page` scanner for Razor Pages and ASP.NET MVC areas with Razor Pages.
import type { PageInfo } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';

const DEFAULT_PAGES_DIR = 'Pages';
const MAX_PAGES = 500;
const PAGE_DIRECTIVE = /^\s*@page(?:[ \t]+"([^"]*)")?/m;

/** `{id}` and `{id:int?}` of a Razor route as `:id`. */
const routeParams = (path: string): string => path.replace(/\{([A-Za-z_]\w*)[^}]*\}/g, ':$1');

/** The URL of a page file: its path under `pagesDir` (`Index` is the folder), or its `@page "…"`. */
export function razorPagePath(
  rel: string,
  directive: string | undefined,
  pagesDir = DEFAULT_PAGES_DIR,
  areaPrefix = '',
): string {
  const parts = rel.slice(pagesDir.length + 1, -'.cshtml'.length).split('/');
  if (parts.at(-1)?.toLowerCase() === 'index') parts.pop();
  const cleanPrefix = areaPrefix.replace(/\/+$/, '');
  const sub = parts.filter((p) => p !== '').join('/');
  const base = sub === '' ? cleanPrefix || '/' : `${cleanPrefix}/${sub}`;
  if (directive === undefined || directive === '') return base;
  if (directive.startsWith('~/')) return routeParams(directive.slice(1));
  if (directive.startsWith('/')) return routeParams(directive);
  return routeParams(`${base === '/' ? '' : base}/${directive}`);
}

export async function walkRazorPageFiles(
  fs: FileSystemPort,
  root: string,
  dir: string,
  out: string[],
): Promise<void> {
  const entries = await fs.readDir(root, dir);
  if (!entries.ok) return;
  for (const entry of entries.value) {
    const path = `${dir}/${entry.name}`;
    if (entry.kind === 'directory' && entry.name !== 'Shared') {
      await walkRazorPageFiles(fs, root, path, out);
    } else if (
      entry.kind === 'file' &&
      entry.name.endsWith('.cshtml') &&
      !entry.name.startsWith('_')
    ) {
      out.push(path);
    }
  }
}

export async function readRazorPagesIn(
  fs: FileSystemPort,
  root: string,
  pagesDir: string,
  areaPrefix = '',
): Promise<PageInfo[]> {
  const files: string[] = [];
  await walkRazorPageFiles(fs, root, pagesDir, files);
  const pages: PageInfo[] = [];
  for (const file of files.slice(0, MAX_PAGES)) {
    const text = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
    const directive = text.ok ? PAGE_DIRECTIVE.exec(text.value) : undefined;
    if (!directive) continue;
    const path = razorPagePath(file, directive[1], pagesDir, areaPrefix);
    pages.push({ path, file, dynamic: path.includes(':') });
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}
