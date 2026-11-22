// The pages of a Next.js project (03b section 1.4): files in `app/` (App Router) and `pages/`
// (Pages Router), read into the same list the Studio shows for every project.
import { inSourceDir, type PageInfo, type PagesInfo } from '@kumicraft/shared';

import type { PagesContext } from '../../../kernel/stacks.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

const PAGE_FILE = /^page\.(tsx|jsx|ts|js)$/;
const SOURCE_FILE = /\.(tsx|jsx|ts|js)$/;
const MAX_PAGES = 500;

/** The URL part of one folder: `(group)` adds nothing, `[slug]` is a parameter. */
export function segmentPath(segment: string): string | undefined {
  if (/^\(.*\)$/.test(segment)) return '';
  const dynamic = /^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/.exec(segment);
  return dynamic ? `:${dynamic[1] ?? ''}` : segment;
}

/** Folders that are not part of a URL: private (`_x`), parallel (`@x`), intercepting (`(.)x`). */
const skipFolder = (name: string): boolean =>
  name.startsWith('_') || name.startsWith('@') || name.startsWith('(.') || name === 'node_modules';

function toPage(segments: readonly string[], file: string): PageInfo {
  const parts = segments.map(segmentPath).filter((p): p is string => p !== undefined && p !== '');
  const path = `/${parts.join('/')}`;
  return { path, file, dynamic: parts.some((p) => p.startsWith(':')) };
}

async function walk(
  fs: FileSystemPort,
  root: string,
  dir: string,
  segments: readonly string[],
  visit: (file: string, name: string, segments: readonly string[]) => void,
): Promise<void> {
  const entries = await fs.readDir(root, dir);
  if (!entries.ok) return;
  for (const entry of entries.value) {
    const path = `${dir}/${entry.name}`;
    if (entry.kind === 'directory' && !skipFolder(entry.name)) {
      await walk(fs, root, path, [...segments, entry.name], visit);
    } else if (entry.kind === 'file') {
      visit(path, entry.name, segments);
    }
  }
}

async function appPages(fs: FileSystemPort, root: string, appDir: string): Promise<PageInfo[]> {
  const pages: PageInfo[] = [];
  await walk(fs, root, appDir, [], (file, name, segments) => {
    if (PAGE_FILE.test(name) && pages.length < MAX_PAGES) pages.push(toPage(segments, file));
  });
  return pages;
}

async function routerPages(
  fs: FileSystemPort,
  root: string,
  pagesDir: string,
): Promise<PageInfo[]> {
  const pages: PageInfo[] = [];
  await walk(fs, root, pagesDir, [], (file, name, segments) => {
    if (!SOURCE_FILE.test(name) || segments[0] === 'api' || name.startsWith('_')) return;
    const stem = name.replace(SOURCE_FILE, '');
    const all = stem === 'index' ? segments : [...segments, stem];
    if (pages.length < MAX_PAGES) pages.push(toPage(all, file));
  });
  return pages;
}

/** The App Router folder when it exists, else the Pages Router one (where new pages go). */
export async function nextRouterDir(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<{ readonly dir: string; readonly kind: 'app' | 'pages' } | undefined> {
  const app = inSourceDir(sourceDir, 'app');
  if (await fs.exists(root, app)) return { dir: app, kind: 'app' };
  const pages = inSourceDir(sourceDir, 'pages');
  if (await fs.exists(root, pages)) return { dir: pages, kind: 'pages' };
  return undefined;
}

export async function readNextPages(ctx: PagesContext): Promise<PagesInfo> {
  const app = inSourceDir(ctx.sourceDir, 'app');
  const pagesDir = inSourceDir(ctx.sourceDir, 'pages');
  const found = [
    ...(await appPages(ctx.fs, ctx.root, app)),
    ...(await routerPages(ctx.fs, ctx.root, pagesDir)),
  ];
  const byPath = new Map(found.map((p) => [p.path, p]));
  const pages = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  const router = await nextRouterDir(ctx.fs, ctx.root, ctx.sourceDir);
  return {
    convention: router !== undefined,
    router:
      router === undefined
        ? { status: 'none', hasRouterPackage: true }
        : { status: 'found', file: router.dir, line: 1, kind: 'fileSystem', chosen: false },
    pages,
  };
}
