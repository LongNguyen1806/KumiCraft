// The pages of an ASP.NET Razor Pages project (docs/architecture/03c section 3.6): a page is a
// `.cshtml` in `Pages/` that starts with `@page`, next to its `.cshtml.cs` model. Adding, renaming
// and removing a page changes both files in one Undo step.
import {
  err,
  ok,
  type PageInfo,
  type PagesInfo,
  type Result,
  type StructureResult,
  toComponentName,
} from '@kumicraft/shared';

import type {
  AddPageInput,
  DeletePageInput,
  PageEditDeps,
  RenamePageInput,
} from '../../../kernel/features.ts';
import { commitFileChanges, type FileChange } from '../../../kernel/file-writer.ts';
import type { PagesContext, PagesProvider } from '../../../kernel/stacks.ts';
import {
  razorPagePath,
  readRazorPagesIn,
  walkRazorPageFiles,
} from '../../../lib/razor/read-pages.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

export { razorPagePath, readRazorPagesIn };

const PAGES = 'Pages';

const readPages = (fs: FileSystemPort, root: string): Promise<PageInfo[]> =>
  readRazorPagesIn(fs, root, PAGES);

export async function readRazorPages(ctx: PagesContext): Promise<PagesInfo> {
  return {
    convention: true,
    router: { status: 'found', file: PAGES, line: 1, kind: 'fileSystem', chosen: false },
    pages: await readPages(ctx.fs, ctx.root),
  };
}

/** The namespace of the page models, read from an existing one (`namespace MyApp.Pages;`). */
async function pagesNamespace(fs: FileSystemPort, root: string): Promise<string> {
  const files: string[] = [];
  await walkRazorPageFiles(fs, root, PAGES, files);
  for (const file of files) {
    const code = await fs.readText(root, `${file}.cs`, { maxBytes: 512 * 1024 });
    const ns = code.ok ? /namespace\s+([\w.]+)/.exec(code.value)?.[1] : undefined;
    if (ns !== undefined) return ns;
  }
  return 'App.Pages';
}

export function razorPageView(model: string, title: string): string {
  const safe = title.replaceAll('@', '@@').replaceAll('<', '&lt;').replaceAll('"', '\\"');
  return `@page\n@model ${model}\n@{\n    ViewData["Title"] = "${safe}";\n}\n\n<div>\n    <h1>${title.replaceAll('@', '@@').replaceAll('<', '&lt;')}</h1>\n</div>\n`;
}

export function razorPageModel(namespace: string, model: string): string {
  return `using Microsoft.AspNetCore.Mvc;\nusing Microsoft.AspNetCore.Mvc.RazorPages;\n\nnamespace ${namespace};\n\npublic class ${model} : PageModel\n{\n    public void OnGet()\n    {\n    }\n}\n`;
}

async function findPage(deps: PageEditDeps, path: string): Promise<PageInfo | undefined> {
  return (await readPages(deps.fs, deps.projectRoot)).find(
    (p) => p.path.toLowerCase() === path.toLowerCase(),
  );
}

const writer = (deps: PageEditDeps) => ({ fs: deps.fs, history: deps.history });

async function addPage(deps: PageEditDeps, input: AddPageInput): Promise<Result<StructureResult>> {
  const name = toComponentName(input.name);
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
    return err({ code: 'E016', params: { reason: 'invalidFileName' } });
  const file = `${PAGES}/${name}.cshtml`;
  if (
    (await findPage(deps, `/${name}`)) !== undefined ||
    (await deps.fs.exists(deps.projectRoot, file))
  ) {
    return err({ code: 'E016', params: { reason: 'pathExists' } });
  }
  const model = `${name}Model`;
  const namespace = await pagesNamespace(deps.fs, deps.projectRoot);
  const changes: FileChange[] = [
    { path: file, before: undefined, after: razorPageView(model, input.name) },
    { path: `${file}.cs`, before: undefined, after: razorPageModel(namespace, model) },
  ];
  const label = { key: 'history:pageAdd', params: { name: input.name } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: [file], locs: [], pagePath: `/${name}` });
}

/** The page's view and its model, as they are now. */
async function pageFiles(
  deps: PageEditDeps,
  page: PageInfo,
): Promise<Result<{ path: string; text: string }[]>> {
  const out: { path: string; text: string }[] = [];
  for (const path of [page.file ?? '', `${page.file ?? ''}.cs`]) {
    const text = await deps.fs.readText(deps.projectRoot, path, { keepBom: true });
    if (text.ok) out.push({ path, text: text.value });
    else if (path === page.file) return text;
  }
  return ok(out);
}

async function renamePage(
  deps: PageEditDeps,
  input: RenamePageInput,
): Promise<Result<StructureResult>> {
  const page = await findPage(deps, input.path);
  if (page?.file === undefined)
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  if (page.path === '/') return err({ code: 'E016', params: { reason: 'indexPage' } });
  const name = toComponentName(input.newName ?? input.newPath?.split('/').pop() ?? '');
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name))
    return err({ code: 'E016', params: { reason: 'invalidFileName' } });
  const dir = page.file.slice(0, page.file.lastIndexOf('/'));
  const newFile = `${dir}/${name}.cshtml`;
  if (await deps.fs.exists(deps.projectRoot, newFile))
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  const files = await pageFiles(deps, page);
  if (!files.ok) return files;
  const changes: FileChange[] = files.value.flatMap((f) => [
    { path: f.path, before: f.text, after: undefined },
    { path: f.path.replace(page.file ?? '', newFile), before: undefined, after: f.text },
  ]);
  const label = { key: 'history:pageRename', params: { name: input.newName ?? name } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({
    changed: true,
    files: [newFile],
    locs: [],
    pagePath: razorPagePath(newFile, undefined),
  });
}

async function deletePage(
  deps: PageEditDeps,
  input: DeletePageInput,
): Promise<Result<StructureResult>> {
  const page = await findPage(deps, input.path);
  if (page?.file === undefined)
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  if (page.path === '/') return err({ code: 'E016', params: { reason: 'indexPage' } });
  const files = await pageFiles(deps, page);
  if (!files.ok) return files;
  const changes = files.value.map((f) => ({ path: f.path, before: f.text, after: undefined }));
  const label = { key: 'history:pageDelete', params: { name: page.path } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: changes.map((c) => c.path), locs: [] });
}

export const razorPagesPages: PagesProvider = {
  read: readRazorPages,
  add: addPage,
  rename: renamePage,
  remove: deletePage,
};
