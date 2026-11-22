// Smooth scrolling to in-page links (K9.8-1 TK-79). QA K9.8-1: a project that already scrolls
// smoothly (its own `scroll-behavior: smooth`, or `scroll-smooth` on <html>) gets no second rule;
// only the offset under a sticky header is added to the target section.
import type { ApplySmoothScrollRequest, ApplySmoothScrollResult, Result } from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';
import MagicString from 'magic-string';

import type { WrittenFile } from '../../../../kernel/editing.ts';
import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import { asAstNode, detectFormat, parseJsxAst } from '../../../../lib/ast-helpers.ts';
import { upsertRuleDeclaration } from '../../../style/css-edit.ts';
import { readClassName, readEditableAttributes } from '../attribute-reader.ts';
import { cacheAst, findNodeAt } from '../source-editor-lookup.ts';
import { mutateAttribute } from '../source-mutator.ts';
import { type DarkModeDeps, findMainCssFile, tailwindMajorVersion } from './dark-mode-service.ts';

const SMOOTH_BLOCK_START = '/* kumicraft:smooth-scroll */';
const SMOOTH_BLOCK_RE =
  /\n?\/\* kumicraft:smooth-scroll \*\/[\s\S]*?\/\* \/kumicraft:smooth-scroll \*\/\n?/g;
const OWN_SMOOTH_RE = /scroll-behavior\s*:\s*smooth/;
const STYLE_FILE_RE = /\.(?:css|scss|sass|less)$/;
const MAX_FILES = 800;

/** The files this action changes, planned before anything is written (one FileWriter step). */
type Plan = Map<string, { readonly before: string; after: string }>;

function planChange(plan: Plan, path: string, before: string, after: string): void {
  const known = plan.get(path);
  if (known) known.after = after;
  else plan.set(path, { before, after });
}

/** What the file reads now, counting the changes already planned. */
async function plannedText(
  deps: DarkModeDeps,
  root: string,
  plan: Plan,
  rel: string,
): Promise<Result<string>> {
  const known = plan.get(rel);
  if (known) return ok(known.after);
  return deps.fs.readText(root, rel, { maxBytes: 1024 * 1024 });
}

/** Whether the project already scrolls smoothly by itself (outside KumiCraft's own block). */
async function projectScrollsSmoothly(deps: DarkModeDeps, root: string): Promise<boolean> {
  const html = await deps.fs.readText(root, 'index.html', { maxBytes: 256 * 1024 });
  if (html.ok && /<html[^>]*\bscroll-smooth\b/.test(html.value)) return true;
  const pending = [deps.sourceDir ?? 'src'];
  let count = 0;
  while (pending.length > 0 && count < MAX_FILES) {
    const dir = pending.pop() ?? '';
    const entries = await deps.fs.readDir(root, dir);
    if (!entries.ok) continue;
    for (const entry of entries.value) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const rel = `${dir}/${entry.name}`;
      if (entry.kind === 'directory') pending.push(rel);
      else if (STYLE_FILE_RE.test(entry.name)) {
        count += 1;
        const text = await deps.fs.readText(root, rel, { maxBytes: 1024 * 1024 });
        if (text.ok && OWN_SMOOTH_RE.test(text.value.replace(SMOOTH_BLOCK_RE, ''))) return true;
      }
    }
  }
  return false;
}

async function applyCssScrollMargin(
  deps: DarkModeDeps,
  root: string,
  cssFile: string,
  idVal: string | undefined,
  headerHeightPx: number,
  plan: Plan,
): Promise<void> {
  const cssRead = await plannedText(deps, root, plan, cssFile);
  if (!idVal || !cssRead.ok) return;
  const updated = upsertRuleDeclaration(
    cssRead.value,
    `#${idVal}`,
    'scroll-margin-top',
    `${String(headerHeightPx)}px`,
    undefined,
    cssFile,
  );
  if (!updated.ok || updated.value === cssRead.value) return;
  planChange(plan, cssFile, cssRead.value, updated.value);
}

function withScrollMarginClass(current: string, headerHeightPx: number): string {
  return [
    ...current.split(/\s+/).filter((t) => t.length > 0 && !/^scroll-mt-/.test(t)),
    `scroll-mt-[${String(headerHeightPx)}px]`,
  ].join(' ');
}

async function applyScrollMarginToTarget(
  deps: DarkModeDeps,
  root: string,
  cssFile: string,
  req: { readonly targetLoc: string; readonly headerHeightPx: number },
  plan: Plan,
): Promise<void> {
  const loc = parseLocString(req.targetLoc);
  if (!loc || req.headerHeightPx <= 0) return;
  const read = await deps.fs.readText(root, loc.file, { maxBytes: 1024 * 1024, keepBom: true });
  if (!read.ok) return;
  const { hasBom } = detectFormat(read.value);
  const code = hasBom ? read.value.slice(1) : read.value;
  const node = findNodeAt(parseJsxAst(code), loc.line, loc.column);
  const opening = node ? asAstNode(node['openingElement']) : undefined;
  if (!node || !opening) return;
  const attrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  if (tailwindMajorVersion(deps.styling) === undefined) {
    const id = readEditableAttributes(attrs, code)['id'];
    const idVal = id?.kind === 'static' ? id.value : undefined;
    await applyCssScrollMargin(deps, root, cssFile, idVal, req.headerHeightPx, plan);
    return;
  }
  const cls = readClassName(attrs, code);
  if (cls.kind === 'expression' || cls.kind === 'duplicate') return;
  const current =
    cls.kind === 'static' || cls.kind === 'callStatic' || cls.kind === 'templateStatic'
      ? cls.value
      : '';
  const s = new MagicString(code);
  mutateAttribute(
    s,
    code,
    opening,
    'className',
    withScrollMarginClass(current, req.headerHeightPx),
  );
  const nextCode = s.toString();
  if (nextCode === code) return;
  const finalText = hasBom ? String.fromCharCode(0xfeff) + nextCode : nextCode;
  planChange(plan, loc.file, read.value, finalText);
}

/** KumiCraft's own smooth-scroll block in the main CSS, added or removed. */
function nextMainCss(css: string, enabled: boolean): string {
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

export async function applyProjectSmoothScroll(
  deps: DarkModeDeps,
  root: string,
  req: ApplySmoothScrollRequest,
): Promise<Result<ApplySmoothScrollResult>> {
  const cssFile = await findMainCssFile(deps, root);
  if (!cssFile) return err({ code: 'E021', params: { missing: 'mainCss' } });
  const read = await deps.fs.readText(root, cssFile, { maxBytes: 1024 * 1024 });
  if (!read.ok) return read;
  const alreadySmooth = req.enabled && (await projectScrollsSmoothly(deps, root));
  const nextCss = alreadySmooth ? read.value : nextMainCss(read.value, req.enabled);
  const plan: Plan = new Map();
  if (nextCss !== read.value) planChange(plan, cssFile, read.value, nextCss);
  if (req.enabled && req.targetLoc && req.headerHeightPx) {
    const target = { targetLoc: req.targetLoc, headerHeightPx: req.headerHeightPx };
    await applyScrollMarginToTarget(deps, root, cssFile, target, plan);
  }
  const changes = [...plan].map(([path, c]) => ({ path, before: c.before, after: c.after }));
  const committed = await commitFileChanges({ fs: deps.fs }, root, changes);
  if (!committed.ok) return committed;
  const writes: WrittenFile[] = committed.value.map((f) => ({
    path: f.path,
    before: f.before,
    after: f.after ?? '',
    beforeHash: f.beforeHash,
    afterHash: f.afterHash ?? '',
  }));
  for (const w of writes) {
    if (!STYLE_FILE_RE.test(w.path)) {
      const code = w.after.startsWith('\uFEFF') ? w.after.slice(1) : w.after;
      cacheAst(w.path, code, w.afterHash, parseJsxAst(code));
    }
  }
  if (writes.length > 0) deps.onWritten?.(writes, 'history:applySmoothScroll');
  return ok({
    changed: writes.length > 0,
    enabled: req.enabled,
    files: writes.map((f) => f.path),
    ...(alreadySmooth ? { alreadySmooth: true } : {}),
  });
}
