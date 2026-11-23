// Adding, renaming and removing an Express page (docs/architecture/03d section 2.2): a page is a
// route (`app.get('/x', …)` or `router.get(…)`) that renders a view, so a page change edits the
// route in the server code and the view file together, in one Undo step.
import {
  err,
  ok,
  type PagesInfo,
  type Result,
  type StructureResult,
  toRoutePath,
} from '@kumicraft/shared';

import type {
  AddPageInput,
  DeletePageInput,
  PageEditDeps,
  RenamePageInput,
} from '../../../kernel/features.ts';
import { commitFileChanges, type FileChange } from '../../../kernel/file-writer.ts';
import type { PagesContext, PagesProvider } from '../../../kernel/stacks.ts';
import { asAstNode, type AstNode, isAstNode, parseJsxAst } from '../../../lib/ast-helpers.ts';
import { detectExpressPug } from './detect.ts';
import { joinExpressPath, scanExpressRoutes } from './routes.ts';

/** A route that renders a view, with the places of its path and view name in the code. */
type RouteSite = {
  readonly file: string;
  readonly fullPath: string;
  readonly path: { readonly value: string; readonly start: number; readonly end: number };
  readonly view?:
    { readonly value: string; readonly start: number; readonly end: number } | undefined;
  readonly stmt: { readonly start: number; readonly end: number };
  readonly receiver: string;
};

const str = (node: AstNode | undefined) =>
  node?.type === 'StringLiteral' && typeof node['value'] === 'string'
    ? { value: node['value'], start: Number(node.start), end: Number(node.end) }
    : undefined;

/** The first `res.render('view', …)` string inside a handler. */
function renderView(node: unknown): { value: string; start: number; end: number } | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = renderView(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isAstNode(node)) return undefined;
  if (node.type === 'CallExpression') {
    const prop = asAstNode(asAstNode(node['callee'])?.['property']);
    const args: unknown[] = Array.isArray(node['arguments']) ? node['arguments'] : [];
    if (prop?.['name'] === 'render') return str(asAstNode(args[0]));
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const found = typeof value === 'object' ? renderView(value) : undefined;
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The top-level `x.get('/path', handler)` statements of a file. */
function routeSites(code: string, file: string, prefix: string): RouteSite[] {
  const program = asAstNode(parseJsxAst(code)['program']);
  const body: unknown[] = Array.isArray(program?.['body']) ? program['body'] : [];
  const out: RouteSite[] = [];
  for (const raw of body) {
    const stmt = asAstNode(raw);
    const call = asAstNode(stmt?.['expression']);
    const callee = asAstNode(call?.['callee']);
    const prop = asAstNode(callee?.['property']);
    const object = asAstNode(callee?.['object']);
    const args: unknown[] = Array.isArray(call?.['arguments']) ? call['arguments'] : [];
    const path = str(asAstNode(args[0]));
    if (
      stmt === undefined ||
      prop?.['name'] !== 'get' ||
      args.length < 2 ||
      path === undefined ||
      !path.value.startsWith('/') ||
      object?.type !== 'Identifier'
    )
      continue;
    out.push({
      file,
      fullPath: joinExpressPath(prefix, path.value),
      path,
      view: renderView(args.slice(1)),
      stmt: { start: Number(stmt.start), end: Number(stmt.end) },
      receiver: String(object['name']),
    });
  }
  return out;
}

/** The last top-level `app.use('/prefix', router)` statement, before any 404 / error middleware. */
function lastMountSite(
  code: string,
): { readonly end: number; readonly receiver: string } | undefined {
  const program = asAstNode(parseJsxAst(code)['program']);
  const body: unknown[] = Array.isArray(program?.['body']) ? program['body'] : [];
  let last: { readonly end: number; readonly receiver: string } | undefined;
  for (const raw of body) {
    const stmt = asAstNode(raw);
    const call = asAstNode(stmt?.['expression']);
    const callee = asAstNode(call?.['callee']);
    const prop = asAstNode(callee?.['property']);
    const object = asAstNode(callee?.['object']);
    const args: unknown[] = Array.isArray(call?.['arguments']) ? call['arguments'] : [];
    const path = str(asAstNode(args[0]));
    if (
      stmt !== undefined &&
      prop?.['name'] === 'use' &&
      path !== undefined &&
      path.value.startsWith('/') &&
      object?.type === 'Identifier'
    ) {
      last = { end: Number(stmt.end), receiver: String(object['name']) };
    }
  }
  return last;
}

type Project = {
  readonly entry: string;
  readonly viewsDir: string;
  readonly scannedFiles: readonly { readonly file: string; readonly prefix: string }[];
};

async function projectOf(deps: PageEditDeps): Promise<Result<Project>> {
  const pkg = await deps.fs.readText(deps.projectRoot, 'package.json');
  let packageJson: unknown;
  try {
    packageJson = pkg.ok ? JSON.parse(pkg.value) : {};
  } catch {
    packageJson = {};
  }
  const report = await detectExpressPug({ root: deps.projectRoot, fs: deps.fs, packageJson });
  if (report.serverEntry === undefined)
    return err({ code: 'E023', params: { reason: 'noServerEntry' } });
  const viewsDir = report.viewsDir ?? 'views';
  const scan = await scanExpressRoutes(deps.fs, deps.projectRoot, report.serverEntry, viewsDir);
  return ok({
    entry: scan.routesFile ?? report.serverEntry,
    viewsDir,
    scannedFiles:
      scan.scannedFiles.length > 0 ? scan.scannedFiles : [{ file: report.serverEntry, prefix: '' }],
  });
}

/** Every route that renders a view: the entry's, and those of the routers it mounts. */
async function allSites(deps: PageEditDeps, project: Project): Promise<RouteSite[]> {
  const sites: RouteSite[] = [];
  for (const { file, prefix } of project.scannedFiles) {
    const code = await deps.fs.readText(deps.projectRoot, file, { keepBom: true });
    if (code.ok) sites.push(...routeSites(code.value.replace(/^\uFEFF/, ''), file, prefix));
  }
  return sites;
}

const viewFile = (project: Project, view: string): string =>
  `${project.viewsDir}/${view.endsWith('.pug') ? view : `${view}.pug`}`;

const writer = (deps: PageEditDeps) => ({ fs: deps.fs, history: deps.history });

/** A new view: like the others, extending the layout when they do. */
async function newView(
  deps: PageEditDeps,
  project: Project,
  sites: readonly RouteSite[],
  title: string,
) {
  const sample = sites.find((s) => s.view !== undefined)?.view?.value;
  const text =
    sample === undefined
      ? undefined
      : await deps.fs.readText(deps.projectRoot, viewFile(project, sample));
  const layout = text?.ok === true ? /^extends\s+(\S+)/m.exec(text.value)?.[1] : undefined;
  const block =
    text?.ok === true ? (/^block\s+(\S+)/m.exec(text.value)?.[1] ?? 'content') : 'content';
  const heading = title.replaceAll('#{', '\\#{');
  return layout === undefined
    ? `h1 ${heading}\n`
    : `extends ${layout}\n\nblock ${block}\n  h1 ${heading}\n`;
}

async function addPage(deps: PageEditDeps, input: AddPageInput): Promise<Result<StructureResult>> {
  const project = await projectOf(deps);
  if (!project.ok) return project;
  const path = input.path ?? toRoutePath(input.name);
  const slug = path.replace(/^\/+/, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug))
    return err({ code: 'E016', params: { reason: 'invalidPath' } });
  const sites = await allSites(deps, project.value);
  const view = viewFile(project.value, slug);
  if (sites.some((s) => s.fullPath === path) || (await deps.fs.exists(deps.projectRoot, view))) {
    return err({ code: 'E016', params: { reason: 'pathExists' } });
  }
  const read = await deps.fs.readText(deps.projectRoot, project.value.entry, { keepBom: true });
  if (!read.ok) return read;
  const code = read.value;
  const bom = code.startsWith('\uFEFF') ? 1 : 0;
  const stripped = code.replace(/^\uFEFF/, '');
  const last = sites.filter((s) => s.file === project.value.entry).at(-1);
  const mount = last === undefined ? lastMountSite(stripped) : undefined;
  const receiver = last?.receiver ?? mount?.receiver ?? 'app';
  const quote = (code.match(/'/g)?.length ?? 0) >= (code.match(/"/g)?.length ?? 0) ? "'" : '"';
  const nl = code.includes('\r\n') ? '\r\n' : '\n';
  const q = (s: string) => `${quote}${s.replaceAll(quote, `\\${quote}`)}${quote}`;
  const route = `${nl}${nl}${receiver}.get(${q(path)}, (req, res) => {${nl}  res.render(${q(slug)}, { title: ${q(input.name)} });${nl}});`;
  const anchorEnd = last?.stmt.end ?? mount?.end;
  const at = anchorEnd === undefined ? code.length : anchorEnd + bom;
  const changes: FileChange[] = [
    { path: project.value.entry, before: code, after: code.slice(0, at) + route + code.slice(at) },
    { path: view, before: undefined, after: await newView(deps, project.value, sites, input.name) },
  ];
  const label = { key: 'history:pageAdd', params: { name: input.name } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: [view], locs: [], pagePath: path });
}

async function siteOf(deps: PageEditDeps, path: string) {
  const project = await projectOf(deps);
  if (!project.ok) return project;
  const sites = await allSites(deps, project.value);
  const site = sites.find((s) => s.fullPath === path);
  if (site === undefined) return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  if (path === '/') return err({ code: 'E016', params: { reason: 'indexPage' } });
  const read = await deps.fs.readText(deps.projectRoot, site.file, { keepBom: true });
  if (!read.ok) return read;
  return ok({ project: project.value, sites, site, code: read.value });
}

async function renamePage(
  deps: PageEditDeps,
  input: RenamePageInput,
): Promise<Result<StructureResult>> {
  const found = await siteOf(deps, input.path);
  if (!found.ok) return found;
  const { project, sites, site, code } = found.value;
  const path = input.newPath ?? toRoutePath(input.newName ?? '');
  const slug = path.replace(/^\/+/, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug))
    return err({ code: 'E016', params: { reason: 'invalidPath' } });
  if (sites.some((s) => s.fullPath === path))
    return err({ code: 'E016', params: { reason: 'pathExists' } });
  const bom = code.startsWith('\uFEFF') ? 1 : 0;
  const quote = code[site.path.start + bom] ?? "'";
  const edits = [{ start: site.path.start, end: site.path.end, text: `${quote}${path}${quote}` }];
  const changes: FileChange[] = [];
  const view = site.view;
  const shared =
    view !== undefined && sites.some((s) => s !== site && s.view?.value === view.value);
  if (view !== undefined && !shared) {
    const from = viewFile(project, view.value);
    const to = viewFile(project, slug);
    const text = await deps.fs.readText(deps.projectRoot, from, { keepBom: true });
    if (text.ok && !(await deps.fs.exists(deps.projectRoot, to))) {
      edits.push({ start: view.start, end: view.end, text: `${quote}${slug}${quote}` });
      changes.push(
        { path: from, before: text.value, after: undefined },
        { path: to, before: undefined, after: text.value },
      );
    }
  }
  let after = code;
  for (const e of edits.sort((a, b) => b.start - a.start))
    after = after.slice(0, e.start + bom) + e.text + after.slice(e.end + bom);
  changes.unshift({ path: site.file, before: code, after });
  const label = { key: 'history:pageRename', params: { name: input.newName ?? path } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: changes.map((c) => c.path), locs: [], pagePath: path });
}

async function deletePage(
  deps: PageEditDeps,
  input: DeletePageInput,
): Promise<Result<StructureResult>> {
  const found = await siteOf(deps, input.path);
  if (!found.ok) return found;
  const { project, sites, site, code } = found.value;
  const bom = code.startsWith('\uFEFF') ? 1 : 0;
  // The statement with the blank line before it.
  const before = code.slice(0, site.stmt.start + bom);
  const start = before.replace(/\s*$/, '').length;
  const changes: FileChange[] = [
    {
      path: site.file,
      before: code,
      after: code.slice(0, start) + code.slice(site.stmt.end + bom),
    },
  ];
  const view = site.view;
  if (view !== undefined && !sites.some((s) => s !== site && s.view?.value === view.value)) {
    const file = viewFile(project, view.value);
    const text = await deps.fs.readText(deps.projectRoot, file, { keepBom: true });
    if (text.ok) changes.push({ path: file, before: text.value, after: undefined });
  }
  const label = { key: 'history:pageDelete', params: { name: input.path } };
  const written = await commitFileChanges(writer(deps), deps.projectRoot, changes, { label });
  if (!written.ok) return written;
  return ok({ changed: true, files: changes.map((c) => c.path), locs: [] });
}

/** Express pages: read from the routes, changed as route + view. */
export function expressPages(read: (ctx: PagesContext) => Promise<PagesInfo>): PagesProvider {
  return { read, add: addPage, rename: renamePage, remove: deletePage };
}
