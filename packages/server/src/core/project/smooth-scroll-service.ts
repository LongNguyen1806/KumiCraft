// Smooth scrolling to in-page links (K9.8-1 TK-79). QA K9.8-1: a project that already scrolls
// smoothly (its own `scroll-behavior: smooth`, or `scroll-smooth` on <html>) gets no second rule;
// only the offset under a sticky header is added to the target section.
import type { ApplySmoothScrollRequest, ApplySmoothScrollResult, Result } from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';
import MagicString from 'magic-string';

import { asAstNode, detectFormat, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { readClassName, readEditableAttributes } from '../source-editor/attribute-reader.ts';
import { cacheAst, computeSha256, findNodeAt } from '../source-editor/source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor/source-editor-service.ts';
import { mutateAttribute } from '../source-editor/source-mutator.ts';
import { upsertRuleDeclaration } from '../style/css-edit.ts';
import { type DarkModeDeps, findMainCssFile, tailwindMajorVersion } from './dark-mode-service.ts';

const SMOOTH_BLOCK_START = '/* kumicraft:smooth-scroll */';
const SMOOTH_BLOCK_RE =
  /\n?\/\* kumicraft:smooth-scroll \*\/[\s\S]*?\/\* \/kumicraft:smooth-scroll \*\/\n?/g;
const OWN_SMOOTH_RE = /scroll-behavior\s*:\s*smooth/;
const STYLE_FILE_RE = /\.(?:css|scss|sass|less)$/;
const MAX_FILES = 800;

function written(path: string, before: string, after: string): WrittenFile {
  return {
    path,
    before,
    after,
    beforeHash: computeSha256(before),
    afterHash: computeSha256(after),
  };
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
  writes: WrittenFile[],
): Promise<void> {
  const cssRead = await deps.fs.readText(root, cssFile, { maxBytes: 1024 * 1024 });
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
  const w = await deps.fs.writeTextAtomic(root, cssFile, updated.value);
  if (w.ok) writes.push(written(cssFile, cssRead.value, updated.value));
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
  writes: WrittenFile[],
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
    await applyCssScrollMargin(deps, root, cssFile, idVal, req.headerHeightPx, writes);
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
  if (!(await deps.fs.writeTextAtomic(root, loc.file, finalText)).ok) return;
  cacheAst(loc.file, nextCode, computeSha256(finalText), parseJsxAst(nextCode));
  writes.push(written(loc.file, read.value, finalText));
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
  const writes: WrittenFile[] = [];
  if (nextCss !== read.value) {
    const w = await deps.fs.writeTextAtomic(root, cssFile, nextCss);
    if (!w.ok) return w;
    writes.push(written(cssFile, read.value, nextCss));
  }
  if (req.enabled && req.targetLoc && req.headerHeightPx) {
    const target = { targetLoc: req.targetLoc, headerHeightPx: req.headerHeightPx };
    await applyScrollMarginToTarget(deps, root, cssFile, target, writes);
  }
  if (writes.length > 0) deps.onWritten?.(writes, 'history:applySmoothScroll');
  return ok({
    changed: writes.length > 0,
    enabled: req.enabled,
    files: writes.map((f) => f.path),
    ...(alreadySmooth ? { alreadySmooth: true } : {}),
  });
}
