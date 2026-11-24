// Pug view features (Express + Pug): partial components (`include`), component extraction, and
// importer discovery. JSX-only tools (drafts, typed props, hooks, router install) return E023.
import { posix } from 'node:path';

import {
  type ApplySmoothScrollRequest,
  type ApplySmoothScrollResult,
  type EnableDarkModeResult,
  err,
  ok,
  parseLocString,
  primarySystem,
  type ProjectComponent,
  type ProjectInfo,
  type RelPath,
  type Result,
  type StructureResult,
  toComponentName,
} from '@kumicraft/shared';

import type { WrittenFile } from '../../../kernel/editing.ts';
import type {
  ComponentsListDeps,
  PageEditDeps,
  ProjectFeatures,
  ProjectToolDeps,
  PropTypesPort,
  ViewFeatures,
} from '../../../kernel/features.ts';
import { commitFileChanges, type FileChange } from '../../../kernel/file-writer.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import { upsertRuleDeclaration } from '../../style/css-edit.ts';
import {
  createPugDraft,
  deletePugDraft,
  duplicatePugDraft,
  listPugDrafts,
  promotePugDraft,
  renamePugDraft,
} from './drafts.ts';
import { stringValue } from './element-source.ts';
import { loadPugFile, pugElementAt } from './pug-file.ts';

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);
const MAX_SCAN_FILES = 2000;
const PUG_DIRECTIVE_RE = /^\s*(?:include|extends)\s+([^\s(]+)/gm;
const RES_RENDER_RE = /\bres\.render\s*\(\s*['"]([^'"]+)['"]/g;

const viewOnlyError = <T>(): Result<T> => err({ code: 'E023', params: { reason: 'viewOnly' } });

function toKebabFileName(name: string): string {
  const kebab = name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${kebab || 'component'}.pug`;
}

function normalizePugFileName(raw: string | undefined, name: string): string {
  if (raw === undefined || raw.trim() === '') return toKebabFileName(name);
  const stripped = raw.trim().replace(/\.(?:tsx|jsx|ts|js|pug)$/i, '');
  return `${stripped || 'component'}.pug`;
}

async function scanFilesByExt(
  fs: FileSystemPort,
  root: string,
  dir: string,
  exts: readonly string[],
  out: string[],
): Promise<boolean> {
  const entries = await fs.readDir(root, dir === '' ? '.' : dir);
  if (!entries.ok) return false;
  for (const entry of [...entries.value].sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
    const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      if (await scanFilesByExt(fs, root, rel, exts, out)) return true;
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(rel);
      if (out.length >= MAX_SCAN_FILES) return true;
    }
  }
  return false;
}

function resolvePugRef(fromFile: string, ref: string, viewsDir: string): string {
  const clean = ref.replaceAll('\\', '/').replace(/\.pug$/i, '');
  const baseDir = clean.startsWith('/') ? viewsDir : posix.dirname(fromFile);
  const target = clean.startsWith('/') ? clean.slice(1) : clean;
  return `${posix.normalize(posix.join(baseDir, target))}.pug`;
}

function collectPugRefs(text: string, fromFile: string, viewsDir: string): string[] {
  const refs: string[] = [];
  for (const match of text.matchAll(PUG_DIRECTIVE_RE)) {
    const raw = match[1];
    if (raw !== undefined) refs.push(resolvePugRef(fromFile, raw, viewsDir));
  }
  return refs;
}

function classifyPugFile(file: string, viewsDir: string): 'component' | 'layout' | undefined {
  const rel = file.startsWith(`${viewsDir}/`) ? file.slice(viewsDir.length + 1) : file;
  if (rel === 'layout.pug' || rel.startsWith('layouts/')) return 'layout';
  if (rel.startsWith('components/') || rel.startsWith('partials/')) return 'component';
  return undefined;
}

async function countPugUsages(
  fs: FileSystemPort,
  root: string,
  pugFiles: readonly string[],
  viewsDir: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const file of pugFiles) {
    const read = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
    if (!read.ok) continue;
    for (const target of collectPugRefs(read.value, file, viewsDir)) {
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  return counts;
}

async function listPugComponents(
  deps: ComponentsListDeps,
  root: string,
  info: ProjectInfo,
): Promise<ProjectComponent[]> {
  const viewsDir = info.support.viewsDir ?? 'views';
  const pugFiles: string[] = [];
  await scanFilesByExt(deps.fs, root, viewsDir, ['.pug'], pugFiles);
  const usages = await countPugUsages(deps.fs, root, pugFiles, viewsDir);
  const components: ProjectComponent[] = [];
  for (const file of pugFiles) {
    const kind = classifyPugFile(file, viewsDir);
    if (kind === undefined) continue;
    const base = posix.basename(file, '.pug');
    const name = toComponentName(base) || base;
    components.push({
      name,
      file,
      kind,
      usages: usages.get(file) ?? 0,
      importStatement: '',
      insertJsx: `include ${file.replace(/\.pug$/i, '')}`,
    });
  }
  return components.sort((a, b) => a.name.localeCompare(b.name));
}

function deindentBlock(block: string, indent: number, newline: string): string {
  const out = block
    .split(/\r?\n/)
    .map((line) =>
      line.length >= indent && /^\s+$/.test(line.slice(0, indent)) ? line.slice(indent) : line,
    )
    .join(newline);
  return out.endsWith(newline) ? out : `${out}${newline}`;
}

function relativeInclude(fromFile: string, targetFile: string): string {
  const rel = posix.relative(posix.dirname(fromFile), targetFile).replace(/\.pug$/i, '');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

async function extractPugComponent(
  deps: PageEditDeps,
  input: {
    readonly loc: string;
    readonly name: string;
    readonly dir?: string | undefined;
    readonly fileName?: string | undefined;
  },
): Promise<Result<StructureResult>> {
  const parsed = parseLocString(input.loc);
  if (parsed === undefined || !parsed.file.endsWith('.pug')) {
    return err({ code: 'E023', params: { reason: 'notPugFile' } });
  }
  const loaded = await loadPugFile(deps.fs, deps.projectRoot, parsed.file);
  if (!loaded.ok) return loaded;
  const el = pugElementAt(loaded.value, parsed.line, parsed.column);
  if (el === undefined) return err({ code: 'E017', params: { reason: 'moved' } });
  if (el.expanded) return err({ code: 'E023', params: { reason: 'notForPug' } });

  const dir = (input.dir ?? 'views/components').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  const compFile = posix.join(dir, normalizePugFileName(input.fileName, input.name));
  if (await deps.fs.exists(deps.projectRoot, compFile)) {
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  }
  const nl = loaded.value.newline;
  const indentText = loaded.value.text.slice(el.lineStart, el.lineStart + el.indent);
  const compContent = deindentBlock(
    loaded.value.text.slice(el.lineStart, el.blockEnd),
    el.indent,
    nl,
  );
  const includeLine = `${indentText}include ${relativeInclude(parsed.file, compFile)}${nl}`;
  const updatedSource =
    loaded.value.text.slice(0, el.lineStart) + includeLine + loaded.value.text.slice(el.blockEnd);
  const beforeSource = loaded.value.bom ? `\uFEFF${loaded.value.text}` : loaded.value.text;
  const afterSource = loaded.value.bom ? `\uFEFF${updatedSource}` : updatedSource;
  const changes: FileChange[] = [
    { path: parsed.file, before: beforeSource, after: afterSource },
    { path: compFile, before: undefined, after: compContent },
  ];
  const label = { key: 'history:extractComponent', params: { name: input.name } };
  const written = await commitFileChanges(
    { fs: deps.fs, history: deps.history },
    deps.projectRoot,
    changes,
    {
      label,
    },
  );
  if (!written.ok) return written;
  return ok({ changed: true, files: [parsed.file, compFile], locs: [] });
}

async function findPugImporters(
  fs: FileSystemPort,
  root: string,
  targetPath: string,
): Promise<Result<{ importers: RelPath[]; truncated: boolean }>> {
  const norm = targetPath.replaceAll('\\', '/');
  const pugFiles: string[] = [];
  const truncatedPug = await scanFilesByExt(fs, root, '', ['.pug'], pugFiles);
  const jsFiles: string[] = [];
  const truncatedJs = await scanFilesByExt(fs, root, '', ['.js', '.cjs', '.mjs'], jsFiles);
  const importers: RelPath[] = [];
  for (const file of pugFiles) {
    if (file === norm) continue;
    const read = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
    if (read.ok && collectPugRefs(read.value, file, 'views').includes(norm)) {
      importers.push(file);
    }
  }
  const slug = norm.replace(/^views\//, '').replace(/\.pug$/i, '');
  for (const file of jsFiles) {
    const read = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
    if (!read.ok) continue;
    for (const match of read.value.matchAll(RES_RENDER_RE)) {
      if (match[1]?.replace(/^\/+/, '').replace(/\.pug$/i, '') === slug) {
        importers.push(file);
        break;
      }
    }
  }
  return ok({ importers, truncated: truncatedPug || truncatedJs });
}

const CSS_DARK_RE = /(?:^|[\s,}])\.dark[\s.:#[>{,]/m;
const JS_DARK_RE = /classList\.(?:add|toggle)\(\s*['"]dark['"]/;
const SMOOTH_BLOCK_START = '/* kumicraft:smooth-scroll */';
const SMOOTH_BLOCK_RE =
  /\n?\/\* kumicraft:smooth-scroll \*\/[\s\S]*?\/\* \/kumicraft:smooth-scroll \*\/\n?/g;

async function checkPugDarkMode(
  deps: ProjectToolDeps,
  root: string,
  checkOnly = false,
): Promise<Result<EnableDarkModeResult>> {
  if (!checkOnly) return err({ code: 'E023', params: { reason: 'projectWideViaAi' } });
  const cssFile = deps.tailwindCss ?? deps.styling?.globalCss[0];
  let enabled =
    primarySystem(deps.styling) === 'tailwind4' || primarySystem(deps.styling) === 'tailwind3';
  if (!enabled) {
    for (const file of deps.styling?.globalCss ?? []) {
      const read = await deps.fs.readText(root, file, { maxBytes: 1024 * 1024 });
      if (read.ok && CSS_DARK_RE.test(read.value)) {
        enabled = true;
        break;
      }
    }
  }
  if (!enabled) {
    const jsFiles: string[] = [];
    await scanFilesByExt(deps.fs, root, 'public', ['.js'], jsFiles);
    for (const file of jsFiles) {
      const read = await deps.fs.readText(root, file, { maxBytes: 512 * 1024 });
      if (read.ok && JS_DARK_RE.test(read.value)) {
        enabled = true;
        break;
      }
    }
  }
  return ok({ enabled, changed: false, files: [], ...(cssFile ? { cssFile } : {}) });
}

function withSmoothScrollBlock(css: string, enabled: boolean): string {
  const nl = css.includes('\r\n') ? '\r\n' : '\n';
  const cleaned = css.replace(SMOOTH_BLOCK_RE, '');
  if (!enabled) return cleaned;
  const block = [
    SMOOTH_BLOCK_START,
    'html { scroll-behavior: smooth; }',
    '@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }',
    '/* /kumicraft:smooth-scroll */',
  ].join(nl);
  const body = cleaned.trimEnd();
  return `${body}${body === '' ? '' : `${nl}${nl}`}${block}${nl}`;
}

async function applyPugSmoothScroll(
  deps: ProjectToolDeps,
  root: string,
  req: ApplySmoothScrollRequest,
): Promise<Result<ApplySmoothScrollResult>> {
  const cssFile = deps.tailwindCss ?? deps.styling?.globalCss[0];
  if (!cssFile) return err({ code: 'E021', params: { missing: 'mainCss' } });
  const read = await deps.fs.readText(root, cssFile, { maxBytes: 1024 * 1024 });
  if (!read.ok) return read;
  const alreadySmooth =
    req.enabled && /scroll-behavior\s*:\s*smooth/.test(read.value.replace(SMOOTH_BLOCK_RE, ''));
  let nextCss = alreadySmooth ? read.value : withSmoothScrollBlock(read.value, req.enabled);
  if (req.enabled && req.targetLoc && req.headerHeightPx && req.headerHeightPx > 0) {
    const parsed = parseLocString(req.targetLoc);
    const loaded = parsed ? await loadPugFile(deps.fs, root, parsed.file) : undefined;
    const el =
      loaded?.ok && parsed ? pugElementAt(loaded.value, parsed.line, parsed.column) : undefined;
    const idPart = el?.parts.find((p) => p.kind === 'id')?.name;
    const idAttr = el?.attrs.find((a) => a.name === 'id');
    const idVal = idPart ?? (idAttr ? stringValue(idAttr.val) : undefined);
    if (idVal) {
      const updated = upsertRuleDeclaration(
        nextCss,
        `#${idVal}`,
        'scroll-margin-top',
        `${String(req.headerHeightPx)}px`,
        undefined,
        cssFile,
      );
      if (updated.ok) nextCss = updated.value;
    }
  }
  if (nextCss === read.value) {
    return ok({
      changed: false,
      enabled: req.enabled,
      files: [],
      ...(alreadySmooth ? { alreadySmooth: true } : {}),
    });
  }
  const committed = await commitFileChanges({ fs: deps.fs }, root, [
    { path: cssFile, before: read.value, after: nextCss },
  ]);
  if (!committed.ok) return committed;
  const writes: WrittenFile[] = committed.value.map((f) => ({
    path: f.path,
    before: f.before,
    after: f.after ?? '',
    beforeHash: f.beforeHash,
    afterHash: f.afterHash ?? '',
  }));
  deps.onWritten?.(writes, 'history:applySmoothScroll');
  return ok({
    changed: true,
    enabled: req.enabled,
    files: [cssFile],
    ...(alreadySmooth ? { alreadySmooth: true } : {}),
  });
}

const noopPropTypes = (): PropTypesPort => () => Promise.resolve(ok([]));

const pugProjectFeatures: ProjectFeatures = {
  readPages: () =>
    Promise.resolve({
      convention: false,
      router: { status: 'none', hasRouterPackage: false },
      pages: [],
    }),
  addPage: () => Promise.resolve(viewOnlyError()),
  renamePage: () => Promise.resolve(viewOnlyError()),
  deletePage: () => Promise.resolve(viewOnlyError()),
  extractComponent: extractPugComponent,
  createPropTypesPort: noopPropTypes,
  listDrafts: listPugDrafts,
  createDraft: createPugDraft,
  renameDraft: renamePugDraft,
  duplicateDraft: duplicatePugDraft,
  deleteDraft: deletePugDraft,
  promoteDraft: promotePugDraft,
  writeRouterFiles: () => Promise.resolve(viewOnlyError()),
};

export const pugFeatures: ViewFeatures = {
  project: pugProjectFeatures,
  readComponentProps: () => Promise.resolve(viewOnlyError()),
  findFileImporters: (fs, root, _sourceDir, targetPath) => findPugImporters(fs, root, targetPath),
  enableDarkMode: checkPugDarkMode,
  applySmoothScroll: applyPugSmoothScroll,
  listComponents: listPugComponents,
  applyInteraction: () => Promise.resolve(viewOnlyError()),
  applyReveal: () => Promise.resolve(viewOnlyError()),
  validateInsertedMarkup: (markup) =>
    ok({ firstTag: /^\s*include\s+\S+/.test(markup) ? 'include' : 'div' }),
};
