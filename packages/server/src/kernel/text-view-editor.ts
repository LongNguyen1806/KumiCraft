// The editor of a view language that is edited as text (Razor, Pug; docs/architecture/03c, 03d):
// the language finds its elements and plans text changes; this module does the rest the same way
// for every such language: locate by loc, write through the file writer (checks, history, Undo),
// merge a batch into one step, save an inserted image and a block's CSS with the view.
import {
  type AttributeLevelEdit,
  type BatchEditResult,
  type EditResult,
  type ElementGuard,
  type ElementSource,
  err,
  type ImageSource,
  type InsertedCssRule,
  ok,
  type PageTree,
  parseLocString,
  type Result,
  type SourceEdit,
  type StructureEdit,
  type StructureResult,
  type StylingReport,
} from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { SourceEditorService, SourceFiles, WrittenFile } from './editing.ts';
import { commitFileChanges, type FileChange, withFileLocks } from './file-writer.ts';
import { computeSha256 } from './history/history-file-io.ts';

/** Text to put in place of `start..end` of a file's text (BOM excluded). */
export type Splice = { readonly start: number; readonly end: number; readonly text: string };

/** A view file as read: its bytes (BOM included) and its text (offsets of the elements). */
export type TextViewFile = {
  readonly rel: string;
  readonly raw: string;
  readonly hash: string;
  readonly text: string;
  readonly bom: boolean;
  readonly newline: '\r\n' | '\n';
};

/** The changes of a structure edit, and where each element it made is (selected afterwards). */
export type StructurePlan = {
  readonly changes: readonly Splice[];
  readonly made: readonly { readonly change: number; readonly within: number }[];
};

export type StructureInput<F, E> = {
  readonly file: F;
  readonly elements: readonly E[];
  readonly ref?: E | undefined;
  readonly styling: StylingReport | undefined;
  readonly imageSrc: string;
};

/** What a text view language gives the editor. */
export interface TextViewLanguage<F extends TextViewFile, E> {
  /** `.cshtml`, `.pug`: a loc of another file is refused with `notFileReason`. */
  readonly extension: string;
  readonly notFileReason: string;
  /** Where an uploaded image goes, and the URL folder that serves it. */
  readonly imagesDir: string;
  readonly imagesUrl: string;
  /** The stylesheet for a block's CSS when the project names none. */
  readonly defaultCss: string;
  load(root: string, rel: string): Promise<Result<F>>;
  elementAt(file: F, line: number, column: number): E | undefined;
  tagOf(element: E): string;
  source(file: F, element: E, loc: string): ElementSource;
  outerText(file: F, element: E): string;
  edit(file: F, element: E, edit: SourceEdit): Result<Splice[]>;
  structure(input: StructureInput<F, E>, edit: StructureEdit): Result<StructurePlan>;
  pageTree(file: F, maxDepth: number | undefined): PageTree;
  sourceFiles(root: string): Promise<Result<SourceFiles>>;
}

/** The text after the changes (applied from the end, so earlier offsets stay right). */
export function applySplices(text: string, changes: readonly Splice[]): string {
  let out = text;
  for (const change of [...changes].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, change.start) + change.text + out.slice(change.end);
  }
  return out;
}

/** 1-based line and column of an offset. */
export function lineColOf(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = text.indexOf('\n'); i >= 0 && i < offset; i = text.indexOf('\n', i + 1)) {
    line += 1;
    lineStart = i + 1;
  }
  return { line, col: offset - lineStart + 1 };
}

/** Appends a block's CSS rules the stylesheet does not have yet. */
export function appendCssRules(
  css: string,
  rules: readonly InsertedCssRule[],
  newline: string,
): string {
  let out = css;
  for (const rule of rules) {
    const selector = rule.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[\\s,}])${selector}\\s*\\{`).test(out)) continue;
    const decls = Object.entries(rule.declarations)
      .map(([property, value]) => `  ${property}: ${value};`)
      .join(newline);
    if (decls === '') continue;
    const gap = out === '' || out.endsWith(newline) ? '' : newline;
    out = `${out}${gap}${newline}${rule.selector} {${newline}${decls}${newline}}${newline}`;
  }
  return out;
}

const fileOfLoc = (loc: string): string => parseLocString(loc)?.file ?? '';

export type TextViewDeps = {
  readonly fs: FileSystemPort;
  readonly styling: () => StylingReport | undefined;
};

type Ctx<F extends TextViewFile, E> = {
  readonly lang: TextViewLanguage<F, E>;
  readonly deps: TextViewDeps;
};

async function locate<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  loc: string,
): Promise<Result<{ file: F; element: E }>> {
  const parsed = parseLocString(loc);
  if (parsed === undefined) return err({ code: 'E016', params: { field: 'loc' } });
  if (!parsed.file.endsWith(ctx.lang.extension)) {
    return err({ code: 'E023', params: { file: parsed.file, reason: ctx.lang.notFileReason } });
  }
  const file = await ctx.lang.load(root, parsed.file);
  if (!file.ok) return file;
  const element = ctx.lang.elementAt(file.value, parsed.line, parsed.column);
  if (element === undefined) return err({ code: 'E017', params: { reason: 'moved' } });
  return ok({ file: file.value, element });
}

const rawOf = (file: TextViewFile, text: string): string => (file.bom ? '\uFEFF' : '') + text;

async function writeText(
  fs: FileSystemPort,
  root: string,
  file: TextViewFile,
  text: string,
): Promise<Result<WrittenFile>> {
  const after = rawOf(file, text);
  const committed = await commitFileChanges({ fs }, root, [
    { path: file.rel, before: file.raw, after },
  ]);
  if (!committed.ok) return committed;
  const afterHash = computeSha256(after);
  return ok({ path: file.rel, before: file.raw, after, beforeHash: file.hash, afterHash });
}

async function elementAfter<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  loc: string,
): Promise<Result<ElementSource>> {
  const found = await locate(ctx, root, loc);
  if (!found.ok) return found;
  return ok(ctx.lang.source(found.value.file, found.value.element, loc));
}

async function applyOne<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  edit: SourceEdit,
  onWritten?: (file: WrittenFile) => void,
): Promise<Result<EditResult>> {
  const found = await locate(ctx, root, edit.loc);
  if (!found.ok) return found;
  const { file, element } = found.value;
  const changes = ctx.lang.edit(file, element, edit);
  if (!changes.ok) return changes;
  if (changes.value.length === 0) {
    const same = ctx.lang.source(file, element, edit.loc);
    return ok({ changed: false, file: file.rel, fileHash: file.hash, element: same });
  }
  const written = await writeText(ctx.deps.fs, root, file, applySplices(file.text, changes.value));
  if (!written.ok) return written;
  onWritten?.(written.value);
  // The element's first character did not move: its loc is the same after the edit.
  const after = await elementAfter(ctx, root, edit.loc);
  if (!after.ok) return after;
  const fileHash = written.value.afterHash;
  return ok({ changed: true, file: file.rel, fileHash, element: after.value });
}

async function applyBatch<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  edits: readonly AttributeLevelEdit[],
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<BatchEditResult>> {
  const written: WrittenFile[] = [];
  let changed = false;
  for (const edit of edits) {
    const res = await applyOne(ctx, root, edit, (file) => written.push(file));
    if (!res.ok) return res;
    changed ||= res.value.changed;
  }
  // One Undo step for the batch: each file from before its first edit to after its last.
  const merged = new Map<string, WrittenFile>();
  for (const file of written) {
    const first = merged.get(file.path);
    const before =
      first === undefined ? {} : { before: first.before, beforeHash: first.beforeHash };
    merged.set(file.path, { ...file, ...before });
  }
  if (merged.size > 0) onWritten?.([...merged.values()]);
  return ok({ changed, files: [...merged.keys()] });
}

function guardsOf(edit: StructureEdit): { elements: readonly ElementGuard[]; ref?: ElementGuard } {
  switch (edit.kind) {
    case 'insert':
    case 'insertImage':
    case 'move': {
      const ref = edit.target.kind === 'sibling' ? edit.target.ref : edit.target.parent;
      return { elements: edit.kind === 'move' ? edit.elements : [], ref };
    }
    case 'unwrap':
      return { elements: [edit.element] };
    case 'wrapText':
    case 'replaceSvg':
      return { elements: [{ loc: edit.loc, tag: edit.tag }] };
    case 'remove':
    case 'duplicate':
    case 'wrap':
      return { elements: edit.elements };
    default:
      return { elements: [] };
  }
}

/** An uploaded image saved under the images folder with a name not taken yet; its `src`. */
async function imageFile<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  image: ImageSource,
): Promise<Result<{ src: string; change?: FileChange }>> {
  if (image.kind === 'existing') return ok({ src: image.src });
  const safe = image.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+/, '');
  const name = safe === '' ? 'image.png' : safe;
  const dot = name.lastIndexOf('.');
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 1; n <= 100; n += 1) {
    const file = n === 1 ? `${stem}${ext}` : `${stem}-${String(n)}${ext}`;
    const path = `${ctx.lang.imagesDir}/${file}`;
    if ((await ctx.deps.fs.stat(root, path)).ok) continue;
    const change: FileChange = {
      path,
      before: undefined,
      after: image.dataBase64,
      encoding: 'base64',
    };
    return ok({ src: `${ctx.lang.imagesUrl}/${file}`, change });
  }
  return err({ code: 'E016', params: { reason: 'fileExists' } });
}

/** A block's CSS rules added to the project's stylesheet (projects without Tailwind). */
async function cssChange<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  edit: StructureEdit,
): Promise<FileChange | undefined> {
  if (edit.kind !== 'insert' || edit.css === undefined || edit.css.rules.length === 0) {
    return undefined;
  }
  const styling = ctx.deps.styling();
  if (styling?.systems.some((s) => s.id === 'tailwind') === true) return undefined;
  const path = styling?.globalCss[0] ?? ctx.lang.defaultCss;
  const read = await ctx.deps.fs.readText(root, path, { maxBytes: 4 * 1024 * 1024, keepBom: true });
  const before = read.ok ? read.value : undefined;
  const newline = before?.includes('\r\n') === true ? '\r\n' : '\n';
  const after = appendCssRules(before ?? '', edit.css.rules, newline);
  return after === before ? undefined : { path, before, after };
}

/** The loc of each element the edit made, in the new text. */
function madeLocs(rel: string, plan: StructurePlan, text: string): string[] {
  return plan.made.flatMap(({ change, within }) => {
    const own = plan.changes[change];
    if (own === undefined) return [];
    const shift = plan.changes
      .filter((c) => c !== own && c.start < own.start)
      .reduce((sum, c) => sum + c.text.length - (c.end - c.start), 0);
    const { line, col } = lineColOf(text, own.start + shift + within);
    return [`${rel}:${String(line)}:${String(col)}`];
  });
}

type Planned<F> = { readonly file: F; readonly plan: StructurePlan; readonly image?: FileChange };

/** Finds the edit's elements in their one file and plans the text changes there. */
async function planIn<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  edit: StructureEdit,
): Promise<Result<Planned<F>>> {
  const guards = guardsOf(edit);
  const all = guards.ref === undefined ? guards.elements : [...guards.elements, guards.ref];
  const elements: E[] = [];
  let file: F | undefined;
  for (const guard of all) {
    const found = await locate(ctx, root, guard.loc);
    if (!found.ok) return found;
    if (ctx.lang.tagOf(found.value.element) !== guard.tag.toLowerCase()) {
      return err({ code: 'E017', params: { reason: 'moved' } });
    }
    file = found.value.file;
    elements.push(found.value.element);
  }
  if (file === undefined) return err({ code: 'E016', params: { reason: 'emptyElements' } });
  const image =
    edit.kind === 'insertImage'
      ? await imageFile(ctx, root, edit.image)
      : ok<{ src: string; change?: FileChange }>({ src: '' });
  if (!image.ok) return image;
  const plan = ctx.lang.structure(
    {
      file,
      elements: elements.slice(0, guards.elements.length),
      ref: guards.ref === undefined ? undefined : elements.at(-1),
      styling: ctx.deps.styling(),
      imageSrc: image.value.src,
    },
    edit,
  );
  if (!plan.ok) return plan;
  const change = image.value.change;
  return ok({ file, plan: plan.value, ...(change === undefined ? {} : { image: change }) });
}

async function runStructure<F extends TextViewFile, E>(
  ctx: Ctx<F, E>,
  root: string,
  edit: StructureEdit,
  onWritten?: (files: readonly WrittenFile[]) => void,
): Promise<Result<StructureResult>> {
  const planned = await planIn(ctx, root, edit);
  if (!planned.ok) return planned;
  const { file, plan } = planned.value;
  const text = applySplices(file.text, plan.changes);
  const css = await cssChange(ctx, root, edit);
  const extra = [planned.value.image, css].filter((c): c is FileChange => c !== undefined);
  const changes = [{ path: file.rel, before: file.raw, after: rawOf(file, text) }, ...extra];
  const committed = await commitFileChanges({ fs: ctx.deps.fs }, root, changes);
  if (!committed.ok) return committed;
  const written: WrittenFile[] = committed.value.map((f) => ({
    path: f.path,
    before: f.before,
    after: f.after ?? '',
    beforeHash: f.beforeHash,
    afterHash: f.afterHash ?? '',
    encoding: f.encoding,
  }));
  if (written.length > 0) onWritten?.(written);
  const files = written.map((w) => w.path);
  return ok({ changed: written.length > 0, files, locs: madeLocs(file.rel, plan, text) });
}

/** The SourceEditorService of a text view language. */
export function createTextViewEditor<F extends TextViewFile, E>(
  lang: TextViewLanguage<F, E>,
  deps: TextViewDeps,
): SourceEditorService {
  const ctx: Ctx<F, E> = { lang, deps };
  const refuseOthers = (files: readonly string[]) =>
    files.some((f) => !f.endsWith(lang.extension))
      ? err({ code: 'E023', params: { reason: lang.notFileReason } })
      : undefined;
  return {
    getElement: (root, loc) => elementAfter(ctx, root, loc),
    async getElementText(root, loc) {
      const found = await locate(ctx, root, loc);
      if (!found.ok) return found;
      const jsx = lang.outerText(found.value.file, found.value.element);
      return ok({ jsx, file: found.value.file.rel, imports: [] });
    },
    async getPageTree(root, rel, maxDepth): Promise<Result<PageTree>> {
      const file = await lang.load(root, rel);
      return file.ok ? ok(lang.pageTree(file.value, maxDepth)) : file;
    },
    listFiles: (root) => lang.sourceFiles(root),
    applyEdit: (root, edit, onWritten) =>
      withFileLocks(root, [fileOfLoc(edit.loc)], () => applyOne(ctx, root, edit, onWritten)),
    applyStructureEdit(root, edit, onWritten) {
      const guards = guardsOf(edit);
      const all = guards.ref === undefined ? guards.elements : [...guards.elements, guards.ref];
      const files = [...new Set(all.map((g) => fileOfLoc(g.loc)))];
      if (files.length > 1) {
        return Promise.resolve(err({ code: 'E023', params: { reason: 'differentFiles' } }));
      }
      return withFileLocks(root, files, () => runStructure(ctx, root, edit, onWritten));
    },
    applyEditBatch(root, edits, onWritten) {
      const files = [...new Set(edits.map((e) => fileOfLoc(e.loc)))];
      const refused = refuseOthers(files);
      if (refused !== undefined) return Promise.resolve(refused);
      return withFileLocks(root, files, () => applyBatch(ctx, root, edits, onWritten));
    },
  };
}
