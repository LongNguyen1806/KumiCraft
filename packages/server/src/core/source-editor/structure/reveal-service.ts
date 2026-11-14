// Generates one-time Scroll Reveal component and wraps/unwraps JSX elements (K9.7-2 TK-18, TK-20, TK-21).
import { createHash } from 'node:crypto';
import { posix } from 'node:path';

import type { Result, RevealEffect, RevealRequest } from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { AstNode } from '../ast-helpers.ts';
import { asAstNode, detectFormat, getJsxTagName, parseJsxAst } from '../ast-helpers.ts';
import { findNodeAt } from '../source-editor-lookup.ts';
import type { WrittenFile } from '../source-editor-service.ts';
import { buildMissingImportsEdits } from './imports.ts';
import { buildRevealComponentCode } from './reveal-template.ts';
import { findAncestors } from './structure-guard.ts';
import { fileIndentUnit, indentOf, lineStartOf } from './structure-ops.ts';
import { applyTextEdits, type TextEdit } from './text-edits.ts';

export { buildRevealComponentCode };

export type RevealDeps = {
  readonly fs: FileSystemPort;
  readonly onWritten?: (files: readonly WrittenFile[]) => void;
};

export type RevealResult = {
  readonly files: readonly string[];
  readonly revealFile: string;
  readonly created: boolean;
  readonly wrapped: boolean;
};

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// Template helpers live in ./reveal-template.ts

async function resolveRevealPath(
  fs: FileSystemPort,
  root: string,
  targetRel: string,
): Promise<{ readonly path: string; readonly tsx: boolean; readonly exists: boolean }> {
  const baseDir = targetRel.startsWith('src/') ? 'src/kumicraft' : 'kumicraft';
  const tsxCandidate = posix.join(baseDir, 'Reveal.tsx');
  const jsxCandidate = posix.join(baseDir, 'Reveal.jsx');
  if (await fs.exists(root, tsxCandidate)) {
    return { path: tsxCandidate, tsx: true, exists: true };
  }
  if (await fs.exists(root, jsxCandidate)) {
    return { path: jsxCandidate, tsx: false, exists: true };
  }
  const isTsx = targetRel.endsWith('.tsx') || (await fs.exists(root, 'tsconfig.json'));
  return { path: isTsx ? tsxCandidate : jsxCandidate, tsx: isTsx, exists: false };
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
  const text = `${indent}<Reveal ${propsText}>${nl}${indented.join(nl)}${nl}${indent}</Reveal>`;
  return { start: replaceStart, end: el.end, text };
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

function buildUnwrapRevealText(
  code: string,
  nl: '\r\n' | '\n',
  revealNode: AstNode,
): string | undefined {
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
  const rawInner = code
    .slice(opening.end, closing.start)
    .replace(/^(?:\r?\n)/, '')
    .replace(/(?:\r?\n)[ \t]*$/, '');
  const unindented = rawInner
    .split(/\r?\n/)
    .map((ln) => (ln.startsWith(unit) ? ln.slice(unit.length) : ln.replace(/^[ \t]{1,2}/, '')));
  const lineStart = lineStartOf(code, revealNode.start);
  const onlyWsBefore = /^[ \t]*$/.test(code.slice(lineStart, revealNode.start));
  const start = onlyWsBefore ? lineStart : revealNode.start;
  return code.slice(0, start) + unindented.join(nl) + code.slice(revealNode.end);
}

async function ensureRevealComponentFile(
  deps: RevealDeps,
  root: string,
  info: { readonly path: string; readonly tsx: boolean; readonly exists: boolean },
): Promise<Result<{ readonly created: boolean; readonly written?: WrittenFile }>> {
  if (info.exists) return ok({ created: false });
  const content = buildRevealComponentCode(info.tsx);
  const wRes = await deps.fs.writeTextAtomic(root, info.path, content);
  if (!wRes.ok) return wRes;
  return ok({
    created: true,
    written: { path: info.path, after: content, afterHash: sha256(content) },
  });
}

type RevealContext = {
  readonly deps: RevealDeps;
  readonly root: string;
  readonly rel: string;
  readonly beforeCode: string;
  readonly ast: AstNode;
  readonly el: AstNode;
  readonly revealInfo: { readonly path: string; readonly tsx: boolean; readonly exists: boolean };
};

async function applyRevealUnwrap(ctx: RevealContext, tag: string): Promise<Result<RevealResult>> {
  const nl = detectFormat(ctx.beforeCode).newline;
  const revealNode = tag === 'Reveal' ? ctx.el : parentRevealNode(ctx.ast, ctx.el);
  if (!revealNode) return err({ code: 'E016', params: { reason: 'notWrappedInReveal' } });
  const unwrapped = buildUnwrapRevealText(ctx.beforeCode, nl, revealNode);
  if (unwrapped === undefined) return err({ code: 'E016', params: { reason: 'unwrapFailed' } });
  const cleaned = removeUnusedRevealImport(unwrapped, parseJsxAst(unwrapped), 'Reveal');
  const wRes = await ctx.deps.fs.writeTextAtomic(ctx.root, ctx.rel, cleaned);
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
  return ok({ files: [ctx.rel], revealFile: ctx.revealInfo.path, created: false, wrapped: false });
}

async function applyRevealWrap(
  ctx: RevealContext,
  request: RevealRequest,
): Promise<Result<RevealResult>> {
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
  if (!edit) return err({ code: 'E016', params: { reason: 'revealWrapFailed' } });

  const importHolder = posix.join(posix.dirname(ctx.revealInfo.path), 'index.ts');
  const importRes = buildMissingImportsEdits(
    ctx.ast,
    ctx.beforeCode,
    ctx.rel,
    ['Reveal'],
    { file: importHolder, imports: ["import { Reveal } from './Reveal';"] },
    nl,
  );
  const edited = applyTextEdits(ctx.beforeCode, [...importRes.edits, edit]);
  if (!edited.ok) return edited;

  const ensureRes = await ensureRevealComponentFile(ctx.deps, ctx.root, ctx.revealInfo);
  if (!ensureRes.ok) return ensureRes;

  const wRes = await ctx.deps.fs.writeTextAtomic(ctx.root, ctx.rel, edited.value.code);
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
