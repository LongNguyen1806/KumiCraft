// Adding, renaming and removing a Next.js page (03b section 1.4): a page is a file (`page.tsx` in a
// folder of `app/`, or a file of `pages/`), so each change is a file change through the FileWriter,
// one Undo step, with the labels the React pages use.
import {
  err,
  ok,
  type PageInfo,
  type Result,
  type StructureResult,
  toComponentName,
  toRoutePath,
} from '@kumicraft/shared';

import type {
  AddPageInput,
  DeletePageInput,
  PageEditDeps,
  RenamePageInput,
} from '../../../kernel/features.ts';
import {
  commitFileChanges,
  type EntryFile,
  moveEntry,
  removeEntry,
} from '../../../kernel/file-writer.ts';
import { nextRouterDir, readNextPages } from './pages-read.ts';

type Router = { readonly dir: string; readonly kind: 'app' | 'pages' };

const SEGMENT = /^(?:[a-z0-9][a-z0-9-]*|\[[a-zA-Z][\w]*\])$/;

/** `/shop/cart` as folder names, or undefined when a part is not a plain or `[param]` name. */
function routeSegments(path: string): string[] | undefined {
  const parts = path.split('/').filter((p) => p !== '');
  return parts.every((p) => SEGMENT.test(p)) ? parts : undefined;
}

function pageFile(router: Router, segments: readonly string[], ext: string): string {
  if (router.kind === 'app') return [router.dir, ...segments, `page.${ext}`].join('/');
  return segments.length === 0
    ? `${router.dir}/index.${ext}`
    : `${router.dir}/${segments.join('/')}.${ext}`;
}

function pageSource(component: string, title: string): string {
  return `export default function ${component}() {\n  return (\n    <main>\n      <h1>${title}</h1>\n    </main>\n  );\n}\n`;
}

async function findPage(deps: PageEditDeps, path: string): Promise<PageInfo | undefined> {
  const info = await readNextPages({
    fs: deps.fs,
    root: deps.projectRoot,
    sourceDir: deps.sourceDir,
    support: { supported: true, reasons: [], versions: {}, language: deps.language },
  });
  return info.pages.find((p) => p.path === path);
}

const writerOf = (deps: PageEditDeps) => ({ fs: deps.fs, history: deps.history });

async function routerOf(deps: PageEditDeps): Promise<Result<Router>> {
  const router = await nextRouterDir(deps.fs, deps.projectRoot, deps.sourceDir);
  return router === undefined
    ? err({ code: 'E023', params: { reason: 'noNextPages' } })
    : ok(router);
}

export async function addNextPage(
  deps: PageEditDeps,
  input: AddPageInput,
): Promise<Result<StructureResult>> {
  const router = await routerOf(deps);
  if (!router.ok) return router;
  const path = input.path ?? toRoutePath(input.name);
  const segments = routeSegments(path);
  if (segments === undefined) return err({ code: 'E016', params: { reason: 'invalidPath' } });
  const routePath = `/${segments.join('/')}`;
  const file = pageFile(router.value, segments, deps.language === 'js' ? 'jsx' : 'tsx');
  if (
    (await findPage(deps, routePath)) !== undefined ||
    (await deps.fs.exists(deps.projectRoot, file))
  ) {
    return err({ code: 'E016', params: { reason: 'pathExists' } });
  }
  const written = await commitFileChanges(
    writerOf(deps),
    deps.projectRoot,
    [{ path: file, before: undefined, after: pageSource(toComponentName(input.name), input.name) }],
    { label: { key: 'history:pageAdd', params: { name: input.name } } },
  );
  if (!written.ok) return written;
  return ok({ changed: true, files: [file], locs: [], pagePath: routePath });
}

/** Every file under `dir`, with its text, for a move or a removal of the folder. */
async function folderFiles(deps: PageEditDeps, dir: string): Promise<Result<EntryFile[]>> {
  const out: EntryFile[] = [];
  const entries = await deps.fs.readDir(deps.projectRoot, dir);
  if (!entries.ok) return entries;
  for (const entry of entries.value) {
    const path = `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      const inner = await folderFiles(deps, path);
      if (!inner.ok) return inner;
      out.push(...inner.value);
    } else {
      const text = await deps.fs.readText(deps.projectRoot, path);
      if (!text.ok) return text;
      out.push({ path, content: text.value });
    }
  }
  return ok(out);
}

/** What a page change moves or removes: the page's folder (App Router) or its file. */
async function pageEntry(
  deps: PageEditDeps,
  page: PageInfo,
  router: Router,
): Promise<Result<{ readonly path: string; readonly files: readonly EntryFile[] }>> {
  const file = page.file ?? '';
  const path = router.kind === 'app' ? file.slice(0, file.lastIndexOf('/')) : file;
  const files =
    router.kind === 'app' ? await folderFiles(deps, path) : await folderOfOne(deps, file);
  return files.ok ? ok({ path, files: files.value }) : files;
}

async function folderOfOne(deps: PageEditDeps, file: string): Promise<Result<EntryFile[]>> {
  const text = await deps.fs.readText(deps.projectRoot, file);
  return text.ok ? ok([{ path: file, content: text.value }]) : text;
}

export async function renameNextPage(
  deps: PageEditDeps,
  input: RenamePageInput,
): Promise<Result<StructureResult>> {
  const router = await routerOf(deps);
  if (!router.ok) return router;
  const page = await findPage(deps, input.path);
  if (page?.file === undefined)
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  if (page.path === '/') return err({ code: 'E016', params: { reason: 'indexPage' } });
  const target =
    input.newPath ?? (input.newName === undefined ? undefined : toRoutePath(input.newName));
  const segments = target === undefined ? undefined : routeSegments(target);
  if (segments === undefined) return err({ code: 'E016', params: { reason: 'invalidPath' } });
  const entry = await pageEntry(deps, page, router.value);
  if (!entry.ok) return entry;
  const newFile = pageFile(router.value, segments, page.file.slice(page.file.lastIndexOf('.') + 1));
  const to = router.value.kind === 'app' ? newFile.slice(0, newFile.lastIndexOf('/')) : newFile;
  if (await deps.fs.exists(deps.projectRoot, to))
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  const label = { key: 'history:pageRename', params: { name: input.newName ?? target ?? '' } };
  const moved = await moveEntry(
    writerOf(deps),
    deps.projectRoot,
    { from: entry.value.path, to, files: entry.value.files },
    { label },
  );
  if (!moved.ok) return moved;
  return ok({ changed: true, files: [newFile], locs: [], pagePath: `/${segments.join('/')}` });
}

export async function deleteNextPage(
  deps: PageEditDeps,
  input: DeletePageInput,
): Promise<Result<StructureResult>> {
  const router = await routerOf(deps);
  if (!router.ok) return router;
  const page = await findPage(deps, input.path);
  if (page?.file === undefined)
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  if (page.path === '/') return err({ code: 'E016', params: { reason: 'indexPage' } });
  const entry = await pageEntry(deps, page, router.value);
  if (!entry.ok) return entry;
  // A folder that holds other pages keeps them: only this page's own file goes.
  const nested = entry.value.files.some(
    (f) => f.path !== page.file && /\/page\.(tsx|jsx|ts|js)$/.test(f.path),
  );
  const removal = nested
    ? { path: page.file, files: entry.value.files.filter((f) => f.path === page.file) }
    : entry.value;
  const label = { key: 'history:pageDelete', params: { name: page.path } };
  const removed = await removeEntry(writerOf(deps), deps.projectRoot, removal, { label });
  if (!removed.ok) return removed;
  return ok({ changed: true, files: removal.files.map((f) => f.path), locs: [] });
}
