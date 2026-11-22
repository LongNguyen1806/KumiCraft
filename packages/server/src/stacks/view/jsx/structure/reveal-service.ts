// Generates one-time Scroll Reveal component and wraps/unwraps JSX elements (K9.7-2 TK-18, TK-20, TK-21).
import { createHash } from 'node:crypto';
import { posix } from 'node:path';

import type { Result, RevealEffect, RevealRequest, RevealResult } from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';

import type { WrittenFile } from '../../../../kernel/editing.ts';
import type { RevealDeps } from '../../../../kernel/features.ts';
import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import type { AstNode } from '../../../../lib/ast-helpers.ts';
import {
  asAstNode,
  detectFormat,
  getJsxTagName,
  parseJsxAst,
} from '../../../../lib/ast-helpers.ts';
import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import { findNodeAt } from '../source-editor-lookup.ts';
import { buildMissingImportsEdits } from './imports.ts';
import { commitKitFiles, type KitPlan, prepareKitPlan } from './kit-service.ts';
import { buildRevealComponentCode } from './reveal-template.ts';
import { findAncestors } from './structure-guard.ts';
import { fileIndentUnit, indentOf, lineStartOf } from './structure-ops.ts';
import { applyTextEdits, offsetToLoc, type TextEdit } from './text-edits.ts';

export { buildRevealComponentCode };

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// Template helpers live in ./reveal-template.ts

async function resolveRevealPath(
  fs: FileSystemPort,
  root: string,
  targetRel: string,
): Promise<{
  readonly path: string;
  readonly exists: boolean;
  readonly kitPlan: KitPlan;
}> {
  const sourceDir = targetRel.startsWith('src/') ? 'src' : '';
  const kitPlan = await prepareKitPlan(fs, root, sourceDir, targetRel, ['Reveal']);
  const relPath = kitPlan.allKitPaths[0] ?? 'src/kumicraft/Reveal.tsx';
  const exists = kitPlan.filesToCreate.length === 0;
  return { path: relPath, exists, kitPlan };
}

function buildRevealPropsText(effect: RevealEffect, delay: number, stagger: number): string {
  const parts = [`effect="${effect}"`];
  if (delay > 0) parts.push(`delay={${String(delay)}}`);
  if (stagger > 0) parts.push(`stagger={${String(stagger)}}`);
  return parts.join(' ');
}

function parentRevealNode(ast: AstNode, el: AstNode): AstNode | undefined {
  const ancestors = findAncestors(ast, el);
  const parent = ancestors.at(-1);
  if (parent === undefined || parent.type !== 'JSXElement') return undefined;
  const opening = asAstNode(parent['openingElement']);
  return opening && getJsxTagName(opening) === 'Reveal' ? parent : undefined;
}

function buildUpdateRevealPropsEdit(
  _code: string,
  revealNode: AstNode,
  propsText: string,
): TextEdit | undefined {
  const opening = asAstNode(revealNode['openingElement']);
  if (!opening || opening.start === undefined || opening.end === undefined) return undefined;
  const selfClosing = opening['selfClosing'] === true;
  const closeToken = selfClosing ? ' />' : '>';
  return {
    start: opening.start,
    end: opening.end,
    text: `<Reveal ${propsText}${closeToken}`,
  };
}

function buildWrapWithRevealEdit(
  code: string,
  nl: '\r\n' | '\n',
  el: AstNode,
  propsText: string,
): TextEdit | undefined {
  if (el.start === undefined || el.end === undefined) return undefined;
  const lineNum = asAstNode(asAstNode(el['loc'])?.['start'])?.['line'];
  const line = typeof lineNum === 'number' ? lineNum : 1;
  const unit = fileIndentUnit(code, line);
  const indent = indentOf(code, el.start);
  const lineStart = lineStartOf(code, el.start);
  const onlyWsBefore = /^[ \t]*$/.test(code.slice(lineStart, el.start));
  const replaceStart = onlyWsBefore ? lineStart : el.start;
  const oldLines = code.slice(el.start, el.end).split(/\r?\n/);
  const indented = oldLines.map((ln, idx) =>
    idx === 0 ? `${indent}${unit}${ln}` : ln.trim() === '' ? '' : `${unit}${ln}`,
  );
  const opening = `${indent}<Reveal ${propsText}>${nl}`;
  const text = `${opening}${indented.join(nl)}${nl}${indent}</Reveal>`;
  // The mark is where the element starts now, one line down and one indent in.
  return {
    start: replaceStart,
    end: el.end,
    text,
    mark: opening.length + indent.length + unit.length,
  };
}

function removeUnusedRevealImport(code: string, ast: AstNode, revealBase: string): string {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const stmtRaw of body) {
    const stmt = asAstNode(stmtRaw);
    if (stmt?.type !== 'ImportDeclaration' || stmt.start === undefined || stmt.end === undefined) {
      continue;
    }
    const sourceNode = asAstNode(stmt['source']);
    const sourceVal = typeof sourceNode?.['value'] === 'string' ? sourceNode['value'] : '';
    if (!sourceVal.endsWith(`/${revealBase}`) && sourceVal !== `./${revealBase}`) continue;
    const afterImport = code.slice(stmt.end);
    if (/\bReveal\b/.test(afterImport)) return code;
    let end = stmt.end;
    if (code.slice(end, end + 2) === '\r\n') end += 2;
    else if (code[end] === '\n') end += 1;
    return code.slice(0, stmt.start) + code.slice(end);
  }
  return code;
}

/** Where `offset` of the inner text lands once each line lost the indent `kept` shows. */
function unindentedOffset(
  raw: string,
  lines: readonly string[],
  kept: readonly string[],
  offset: number,
  nl: string,
): number {
  const before = raw.slice(0, offset).split(/\r?\n/);
  const k = before.length - 1;
  const removed = (lines[k]?.length ?? 0) - (kept[k]?.length ?? 0);
  let pos = 0;
  for (let i = 0; i < k; i++) pos += (kept[i]?.length ?? 0) + nl.length;
  return pos + Math.max(0, (before.at(-1) ?? '').length - removed);
}

/** The element that shows on the Canvas in place of the `<Reveal>`: `el`, else its first child. */
function shownElement(revealNode: AstNode, el: AstNode): AstNode | undefined {
  if (el !== revealNode) return el;
  const children: unknown[] = Array.isArray(revealNode['children']) ? revealNode['children'] : [];
  return children.map(asAstNode).find((c) => c?.type === 'JSXElement');
}

/**
 * The new loc of a page element (lowercase tag) the Canvas can select again; a component use
 * (`<Card>`, the `<Reveal>` itself) has no element of its own in the page.
 */
function elementLoc(
  rel: string,
  code: string,
  node: AstNode | undefined,
  mark: number | undefined,
): { readonly loc?: string } {
  const opening = node === undefined ? undefined : asAstNode(node['openingElement']);
  const tag = opening === undefined ? undefined : getJsxTagName(opening);
  if (mark === undefined || tag === undefined || !/^[a-z]/.test(tag)) return {};
  return { loc: offsetToLoc(rel, code, mark) };
}

function buildUnwrapRevealText(
  code: string,
  nl: '\r\n' | '\n',
  revealNode: AstNode,
  shown: AstNode | undefined,
): { readonly code: string; readonly mark?: number } | undefined {
  const opening = asAstNode(revealNode['openingElement']);
  const closing = asAstNode(revealNode['closingElement']);
  if (
    revealNode.start === undefined ||
    revealNode.end === undefined ||
    opening?.end === undefined ||
    closing?.start === undefined
  ) {
    return undefined;
  }
  const lineNum = asAstNode(asAstNode(revealNode['loc'])?.['start'])?.['line'];
  const line = typeof lineNum === 'number' ? lineNum : 1;
  const unit = fileIndentUnit(code, line);
  const inner = code.slice(opening.end, closing.start);
  const lead = /^\r?\n/.exec(inner)?.[0].length ?? 0;
  const rawInner = inner.slice(lead).replace(/(?:\r?\n)[ \t]*$/, '');
  const lines = rawInner.split(/\r?\n/);
  const unindented = lines.map((ln) =>
    ln.startsWith(unit) ? ln.slice(unit.length) : ln.replace(/^[ \t]{1,2}/, ''),
  );
  const lineStart = lineStartOf(code, revealNode.start);
  const onlyWsBefore = /^[ \t]*$/.test(code.slice(lineStart, revealNode.start));
  const start = onlyWsBefore ? lineStart : revealNode.start;
  const unwrapped = code.slice(0, start) + unindented.join(nl) + code.slice(revealNode.end);
  const offset = shown?.start === undefined ? -1 : shown.start - opening.end - lead;
  if (offset < 0 || offset > rawInner.length) return { code: unwrapped };
  return {
    code: unwrapped,
    mark: start + unindentedOffset(rawInner, lines, unindented, offset, nl),
  };
}

async function ensureRevealComponentFile(
  deps: RevealDeps,
  root: string,
  info: { readonly path: string; readonly exists: boolean; readonly kitPlan: KitPlan },
): Promise<Result<{ readonly created: boolean; readonly written?: WrittenFile }>> {
  if (info.exists || info.kitPlan.filesToCreate.length === 0) return ok({ created: false });
  const res = await commitKitFiles(deps.fs, root, info.kitPlan.filesToCreate);
  if (!res.ok) return res;
  const written = res.value[0];
  return ok(written !== undefined ? { created: true, written } : { created: false });
}

type RevealContext = {
  readonly deps: RevealDeps;
  readonly root: string;
  readonly rel: string;
  readonly beforeCode: string;
  readonly ast: AstNode;
  readonly el: AstNode;
  readonly revealInfo: {
    readonly path: string;
    readonly exists: boolean;
    readonly kitPlan: KitPlan;
  };
};

async function applyRevealUnwrap(ctx: RevealContext, tag: string): Promise<Result<RevealResult>> {
  const nl = detectFormat(ctx.beforeCode).newline;
  const revealNode = tag === 'Reveal' ? ctx.el : parentRevealNode(ctx.ast, ctx.el);
  if (!revealNode) return err({ code: 'E016', params: { reason: 'notWrappedInReveal' } });
  const shown = shownElement(revealNode, ctx.el);
  const unwrapped = buildUnwrapRevealText(ctx.beforeCode, nl, revealNode, shown);
  if (unwrapped === undefined) return err({ code: 'E016', params: { reason: 'unwrapFailed' } });
  const cleaned = removeUnusedRevealImport(unwrapped.code, parseJsxAst(unwrapped.code), 'Reveal');
  // The import goes from above the JSX: the element moves up by what the import took.
  const mark =
    unwrapped.mark === undefined
      ? undefined
      : unwrapped.mark - (unwrapped.code.length - cleaned.length);
  const wRes = await commitFileChanges({ fs: ctx.deps.fs }, ctx.root, [
    { path: ctx.rel, before: ctx.beforeCode, after: cleaned },
  ]);
  if (!wRes.ok) return wRes;
  ctx.deps.onWritten?.([
    {
      path: ctx.rel,
      before: ctx.beforeCode,
      after: cleaned,
      beforeHash: sha256(ctx.beforeCode),
      afterHash: sha256(cleaned),
    },
  ]);
  return ok({
    files: [ctx.rel],
    revealFile: ctx.revealInfo.path,
    created: false,
    wrapped: false,
    ...elementLoc(ctx.rel, cleaned, shown, mark),
  });
}

/** The wrap (or the new props of the Reveal already there) and the import it needs. */
function wrapEdits(ctx: RevealContext, request: RevealRequest): TextEdit[] | undefined {
  const nl = detectFormat(ctx.beforeCode).newline;
  const propsText = buildRevealPropsText(
    request.effect ?? 'fade',
    request.delay ?? 0,
    request.stagger ?? 0,
  );
  const existingReveal = request.tag === 'Reveal' ? ctx.el : parentRevealNode(ctx.ast, ctx.el);
  const edit = existingReveal
    ? buildUpdateRevealPropsEdit(ctx.beforeCode, existingReveal, propsText)
    : buildWrapWithRevealEdit(ctx.beforeCode, nl, ctx.el, propsText);
  if (!edit) return undefined;
  const importHolder = posix.join(posix.dirname(ctx.revealInfo.path), 'index.ts');
  const importRes = buildMissingImportsEdits(
    ctx.ast,
    ctx.beforeCode,
    ctx.rel,
    ['Reveal'],
    { file: importHolder, imports: ["import { Reveal } from './Reveal';"] },
    nl,
  );
  // Under an existing Reveal only its opening changes: an empty edit at the element tells where
  // the element is after (its column moves when it shares the opening's line).
  const markEdits: TextEdit[] =
    existingReveal !== undefined && existingReveal !== ctx.el && ctx.el.start !== undefined
      ? [{ start: ctx.el.start, end: ctx.el.start, text: '', mark: 0 }]
      : [];
  return [...importRes.edits, edit, ...markEdits];
}

async function applyRevealWrap(
  ctx: RevealContext,
  request: RevealRequest,
): Promise<Result<RevealResult>> {
  const edits = wrapEdits(ctx, request);
  if (!edits) return err({ code: 'E016', params: { reason: 'revealWrapFailed' } });
  const edited = applyTextEdits(ctx.beforeCode, edits);
  if (!edited.ok) return edited;

  const ensureRes = await ensureRevealComponentFile(ctx.deps, ctx.root, ctx.revealInfo);
  if (!ensureRes.ok) return ensureRes;

  const wRes = await commitFileChanges({ fs: ctx.deps.fs }, ctx.root, [
    { path: ctx.rel, before: ctx.beforeCode, after: edited.value.code },
  ]);
  if (!wRes.ok) return wRes;
  const sourceWritten: WrittenFile = {
    path: ctx.rel,
    before: ctx.beforeCode,
    after: edited.value.code,
    beforeHash: sha256(ctx.beforeCode),
    afterHash: sha256(edited.value.code),
  };
  const writtenFiles = ensureRes.value.written
    ? [ensureRes.value.written, sourceWritten]
    : [sourceWritten];
  ctx.deps.onWritten?.(writtenFiles);
  return ok({
    files: writtenFiles.map((f) => f.path),
    revealFile: ctx.revealInfo.path,
    created: ensureRes.value.created,
    wrapped: true,
    ...elementLoc(ctx.rel, edited.value.code, ctx.el, edited.value.marks[0]),
  });
}

export async function applyRevealEdit(
  deps: RevealDeps,
  root: string,
  request: RevealRequest,
): Promise<Result<RevealResult>> {
  const parsedLoc = parseLocString(request.loc);
  if (!parsedLoc) return err({ code: 'E016', params: { reason: 'invalidLoc' } });
  const rel = parsedLoc.file;
  const readRes = await deps.fs.readText(root, rel, { keepBom: true });
  if (!readRes.ok)
    return err({ code: 'E017', params: { loc: request.loc, reason: 'missingFile' } });
  const beforeCode = readRes.value;
  let ast: AstNode;
  try {
    ast = parseJsxAst(beforeCode);
  } catch {
    return err({ code: 'E024', params: { reason: 'jsxParse' } });
  }
  const el = findNodeAt(ast, parsedLoc.line, parsedLoc.column);
  if (!el) return err({ code: 'E017', params: { loc: request.loc, reason: 'notFound' } });
  const opening = asAstNode(el['openingElement']);
  if (!opening || getJsxTagName(opening) !== request.tag) {
    return err({ code: 'E017', params: { loc: request.loc, reason: 'moved' } });
  }
  const revealInfo = await resolveRevealPath(deps.fs, root, rel);
  const ctx: RevealContext = { deps, root, rel, beforeCode, ast, el, revealInfo };
  return request.action === 'unwrap'
    ? applyRevealUnwrap(ctx, request.tag)
    : applyRevealWrap(ctx, request);
}

export type { RevealDeps };
