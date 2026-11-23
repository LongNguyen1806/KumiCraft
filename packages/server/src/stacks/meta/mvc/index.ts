// The pages of an ASP.NET MVC project (docs/architecture/03c section 3.6): an action of a
// controller (`HomeController.Privacy()`) with its view (`Views/Home/Privacy.cshtml`), at the
// default route `{controller=Home}/{action=Index}`. A page change edits the view and the action
// together, in one Undo step.
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
import { readRazorPagesIn } from '../../../lib/razor/read-pages.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { closingBrace, conventionPath, type MvcAction, readMvcActions } from './read-actions.ts';

const CONTROLLERS = 'Controllers';

type Action = MvcAction;

/** The URL of an action at the default route. */
export const mvcPath = (controller: string, action: string): string =>
  conventionPath(undefined, controller, action);

async function pagesOf(
  fs: FileSystemPort,
  root: string,
): Promise<(PageInfo & { action: Action })[]> {
  return (await readMvcActions(fs, root)).map((action) => ({
    path: action.path,
    file: action.view,
    dynamic: action.path.includes(':'),
    action,
  }));
}

async function readMvcRazorPages(fs: FileSystemPort, root: string): Promise<PageInfo[]> {
  const out = [...(await readRazorPagesIn(fs, root, 'Pages'))];
  const areas = await fs.readDir(root, 'Areas');
  if (areas.ok) {
    for (const entry of areas.value) {
      if (entry.kind !== 'directory') continue;
      out.push(
        ...(await readRazorPagesIn(fs, root, `Areas/${entry.name}/Pages`, `/${entry.name}`)),
      );
    }
  }
  return out;
}

export async function readMvcPages(ctx: PagesContext): Promise<PagesInfo> {
  const byPath = new Map<string, PageInfo>();
  for (const { path, file, dynamic } of await pagesOf(ctx.fs, ctx.root)) {
    byPath.set(path.toLowerCase(), { path, file, dynamic });
  }
  for (const page of await readMvcRazorPages(ctx.fs, ctx.root)) {
    if (!byPath.has(page.path.toLowerCase())) byPath.set(page.path.toLowerCase(), page);
  }
  return {
    convention: true,
    router: { status: 'found', file: CONTROLLERS, line: 1, kind: 'fileSystem', chosen: false },
    pages: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/** Where a method's lines begin: its `[Attribute]` lines above it and one blank line before. */
function methodStart(code: string, lineStart: number): number {
  let start = lineStart;
  for (;;) {
    const prev = code.lastIndexOf('\n', start - 2) + 1;
    const line = code.slice(prev, start).trim();
    if (start === 0 || !/^\[.*\]$/.test(line)) break;
    start = prev;
  }
  const prev = code.lastIndexOf('\n', start - 2) + 1;
  return start > 0 && code.slice(prev, start).trim() === '' ? prev : start;
}

/** The whole method of an action (its lines), so it can be renamed or removed. */
export function actionSpan(
  code: string,
  action: string,
): { start: number; end: number } | undefined {
  const sig = new RegExp(
    `public\\s+(?:async\\s+)?(?:Task<\\s*)?I?ActionResult\\s*>?\\s+${action}\\s*\\(`,
  ).exec(code);
  if (!sig) return undefined;
  const start = methodStart(code, code.lastIndexOf('\n', sig.index) + 1);
  const arrow = code.indexOf('=>', sig.index);
  const brace = code.indexOf('{', sig.index);
  let end: number;
  if (arrow >= 0 && (brace < 0 || arrow < brace)) end = code.indexOf(';', arrow) + 1;
  else end = closingBrace(code, brace) + 1;
  if (end <= 0) return undefined;
  const lineEnd = code.indexOf('\n', end);
  return { start, end: lineEnd < 0 ? code.length : lineEnd + 1 };
}

/** The controller code with a new action `X() => View();` before the class's last `}`. */
export function withAction(code: string, controller: string, action: string): string | undefined {
  const cls = new RegExp(`class\\s+${controller}Controller\\b`).exec(code);
  if (!cls) return undefined;
  const close = closingBrace(code, code.indexOf('{', cls.index));
  if (close < 0) return undefined;
  const indent = /\n([ \t]*)public\s/.exec(code.slice(cls.index))?.[1] ?? '    ';
  const nl = code.includes('\r\n') ? '\r\n' : '\n';
  const lineStart = code.lastIndexOf('\n', close) + 1;
  const method = `${nl}${indent}public IActionResult ${action}()${nl}${indent}{${nl}${indent}    return View();${nl}${indent}}${nl}`;
  return code.slice(0, lineStart).replace(/\s*$/, '') + nl + method + code.slice(lineStart);
}

export function mvcView(title: string): string {
  const text = title.replaceAll('@', '@@').replaceAll('<', '&lt;');
  return `@{\n    ViewData["Title"] = "${text.replaceAll('"', '\\"')}";\n}\n\n<div>\n    <h1>${text}</h1>\n</div>\n`;
}

const writer = (deps: PageEditDeps) => ({ fs: deps.fs, history: deps.history });

async function addPage(deps: PageEditDeps, input: AddPageInput): Promise<Result<StructureResult>> {
  const action = toComponentName(input.name);
  if (!/^[A-Z][A-Za-z0-9]*$/.test(action))
    return err({ code: 'E016', params: { reason: 'invalidFileName' } });
  // The Home controller wherever it is (a subfolder of Controllers, another project folder).
  const home = (await readMvcActions(deps.fs, deps.projectRoot)).find(
    (a) => a.controller === 'Home' && a.area === undefined,
  );
  const file = home?.file ?? `${CONTROLLERS}/HomeController.cs`;
  const view = `Views/Home/${action}.cshtml`;
  const code = await deps.fs.readText(deps.projectRoot, file, { keepBom: true });
  if (!code.ok) return err({ code: 'E023', params: { reason: 'noRazorViews' } });
  if (
    actionSpan(code.value, action) !== undefined ||
    (await deps.fs.exists(deps.projectRoot, view))
  ) {
    return err({ code: 'E016', params: { reason: 'pathExists' } });
  }
  const after = withAction(code.value, 'Home', action);
  if (after === undefined) return err({ code: 'E023', params: { reason: 'noRazorViews' } });
  const changes: FileChange[] = [
    { path: file, before: code.value, after },
    { path: view, before: undefined, after: mvcView(input.name) },
  ];
  const label = { key: 'history:pageAdd', params: { name: input.name } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: [view], locs: [], pagePath: mvcPath('Home', action) });
}

async function findPage(deps: PageEditDeps, path: string) {
  return (await pagesOf(deps.fs, deps.projectRoot)).find(
    (p) => p.path.toLowerCase() === path.toLowerCase(),
  );
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
  const { controller, action, file } = page.action;
  const newView = `Views/${controller}/${name}.cshtml`;
  if (await deps.fs.exists(deps.projectRoot, newView))
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  const code = await deps.fs.readText(deps.projectRoot, file, { keepBom: true });
  const view = await deps.fs.readText(deps.projectRoot, page.file, { keepBom: true });
  if (!code.ok) return code;
  if (!view.ok) return view;
  const renamed = code.value.replace(
    new RegExp(`(ActionResult\\s*>?\\s+)${action}(\\s*\\()`),
    `$1${name}$2`,
  );
  const changes: FileChange[] = [
    { path: file, before: code.value, after: renamed },
    { path: page.file, before: view.value, after: undefined },
    { path: newView, before: undefined, after: view.value },
  ];
  const label = { key: 'history:pageRename', params: { name: input.newName ?? name } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: [newView], locs: [], pagePath: mvcPath(controller, name) });
}

async function deletePage(
  deps: PageEditDeps,
  input: DeletePageInput,
): Promise<Result<StructureResult>> {
  const page = await findPage(deps, input.path);
  if (page?.file === undefined)
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  if (page.path === '/') return err({ code: 'E016', params: { reason: 'indexPage' } });
  const code = await deps.fs.readText(deps.projectRoot, page.action.file, { keepBom: true });
  const view = await deps.fs.readText(deps.projectRoot, page.file, { keepBom: true });
  if (!code.ok) return code;
  if (!view.ok) return view;
  const span = actionSpan(code.value, page.action.action);
  const after =
    span === undefined ? code.value : code.value.slice(0, span.start) + code.value.slice(span.end);
  const changes: FileChange[] = [
    { path: page.action.file, before: code.value, after },
    { path: page.file, before: view.value, after: undefined },
  ];
  const label = { key: 'history:pageDelete', params: { name: page.path } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: [page.file], locs: [] });
}

export const mvcPages: PagesProvider = {
  read: readMvcPages,
  add: addPage,
  rename: renamePage,
  remove: deletePage,
};
