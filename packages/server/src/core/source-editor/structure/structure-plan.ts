// Plan building per file for structure operations (SPEC-04 R-SE-22..28).
import type { ElementGuard, Result, StructureEdit } from '@reactcraft/shared';
import { err, ok } from '@reactcraft/shared';

import { asAstNode, type AstNode, getJsxTagName, parseJsxAst } from '../ast-helpers.ts';
import { findNodeAt, validateLocAndExt } from '../source-editor-lookup.ts';
import { collectComponentTags } from './element-text.ts';
import { buildMissingImportsEdits } from './imports.ts';
import { buildSameFileMoveEdits } from './move-ops.ts';
import {
  buildDuplicateTextEdits,
  buildInsertTextEdit,
  buildRemoveTextEdits,
  type ResolvedElement,
} from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';
import { buildUnwrapTextEdit, buildWrapTextEdit } from './wrap-ops.ts';

export type GuardWithPosition = {
  readonly loc: string;
  readonly tag: string;
  readonly rel: string;
  readonly line: number;
  readonly column: number;
};

export function validateGuards(
  guards: readonly ElementGuard[],
  sourceDir: string,
  sourceExtensions: readonly string[],
): Result<readonly GuardWithPosition[]> {
  const out: GuardWithPosition[] = [];
  for (const g of guards) {
    const valRes = validateLocAndExt(g.loc, sourceDir, sourceExtensions);
    if (!valRes.ok) return valRes;
    out.push({
      loc: g.loc,
      tag: g.tag,
      rel: valRes.value.rel,
      line: valRes.value.line,
      column: valRes.value.column,
    });
  }
  return ok(out);
}

export function resolveElementsInAst(
  ast: AstNode,
  guards: readonly GuardWithPosition[],
): Result<readonly ResolvedElement[]> {
  const resolved: ResolvedElement[] = [];
  for (const g of guards) {
    const node = findNodeAt(ast, g.line, g.column);
    if (!node || node.start === undefined || node.end === undefined) {
      return err({ code: 'E017', params: { loc: g.loc, reason: 'moved' } });
    }
    const opening = asAstNode(node['openingElement']) ?? { type: 'JSXOpeningElement' };
    if (getJsxTagName(opening) !== g.tag) {
      return err({ code: 'E017', params: { loc: g.loc, reason: 'moved' } });
    }
    resolved.push({
      loc: g.loc,
      node,
      opening,
      start: node.start,
      end: node.end,
      line: g.line,
    });
  }
  return ok(resolved);
}

export type FilePlanResult = {
  readonly edits: readonly TextEdit[];
  readonly warnings?: readonly string[];
  readonly locsFromMarks?: boolean;
};

export type PlanContext = {
  readonly targetGuard?: GuardWithPosition | undefined;
  readonly targetResolved?: ResolvedElement | undefined;
  readonly movingJsx?: string | undefined;
  readonly sourceFile?: string | undefined;
  readonly sourceImports?: readonly string[] | undefined;
  readonly movingTags?: readonly string[] | undefined;
};

function planInsert(
  ast: AstNode,
  code: string,
  rel: string,
  nl: '\r\n' | '\n',
  resolved: readonly ResolvedElement[],
  edit: Extract<StructureEdit, { kind: 'insert' }>,
): Result<FilePlanResult> {
  const first = resolved[0];
  if (!first) return err({ code: 'E016', params: { reason: 'empty' } });

  const insertEditRes = buildInsertTextEdit(
    ast,
    code,
    nl,
    edit.target.kind,
    edit.target.where,
    first,
    edit.jsx,
  );
  if (!insertEditRes.ok) return insertEditRes;

  let astSnippet: AstNode | undefined;
  try {
    astSnippet = parseJsxAst(`<>${edit.jsx}</>`);
  } catch {
    // validated previously
  }
  const snippetTags = astSnippet ? collectComponentTags(astSnippet) : [];
  const autoImports = buildMissingImportsEdits(ast, code, rel, snippetTags, edit.from, nl);

  return ok({
    edits: [...autoImports.edits, insertEditRes.value],
    warnings: autoImports.warnings,
    locsFromMarks: true,
  });
}

function planMoveCrossFileTarget(
  ast: AstNode,
  code: string,
  rel: string,
  nl: '\r\n' | '\n',
  edit: Extract<StructureEdit, { kind: 'move' }>,
  context: PlanContext,
): Result<FilePlanResult> {
  if (!context.targetResolved || !context.movingJsx) {
    return ok({ edits: [], locsFromMarks: false });
  }

  const insertEditRes = buildInsertTextEdit(
    ast,
    code,
    nl,
    edit.target.kind,
    edit.target.where,
    context.targetResolved,
    context.movingJsx,
  );
  if (!insertEditRes.ok) return insertEditRes;

  const fromData =
    context.sourceFile && context.sourceImports
      ? { file: context.sourceFile, imports: context.sourceImports }
      : undefined;

  const autoImports = buildMissingImportsEdits(
    ast,
    code,
    rel,
    context.movingTags ?? [],
    fromData,
    nl,
  );

  return ok({
    edits: [...autoImports.edits, insertEditRes.value],
    warnings: autoImports.warnings,
    locsFromMarks: true,
  });
}

function planMove(
  ast: AstNode,
  code: string,
  rel: string,
  nl: '\r\n' | '\n',
  resolved: readonly ResolvedElement[],
  edit: Extract<StructureEdit, { kind: 'move' }>,
  context?: PlanContext,
): Result<FilePlanResult> {
  const targetRel = context?.targetGuard?.rel;

  if (targetRel === rel && resolved.length > 0 && context?.targetResolved) {
    const moveRes = buildSameFileMoveEdits(
      ast,
      code,
      nl,
      resolved,
      edit.target.kind,
      edit.target.where,
      context.targetResolved,
    );
    return moveRes.ok ? ok({ edits: moveRes.value.edits, locsFromMarks: true }) : moveRes;
  }

  if (resolved.length > 0) {
    const remRes = buildRemoveTextEdits(ast, code, resolved);
    return remRes.ok ? ok({ edits: remRes.value, locsFromMarks: false }) : remRes;
  }

  if (context?.targetResolved && context.movingJsx) {
    return planMoveCrossFileTarget(ast, code, rel, nl, edit, context);
  }

  return ok({ edits: [], locsFromMarks: false });
}

function planWrapOrUnwrap(
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  resolved: readonly ResolvedElement[],
  edit: Extract<StructureEdit, { kind: 'wrap' | 'unwrap' }>,
): Result<FilePlanResult> {
  if (edit.kind === 'wrap') {
    const wrapRes = buildWrapTextEdit(ast, code, nl, resolved, edit.wrapper);
    return wrapRes.ok ? ok({ edits: wrapRes.value.edits, locsFromMarks: true }) : wrapRes;
  }
  const first = resolved[0];
  if (!first) return err({ code: 'E016', params: { reason: 'empty' } });
  const unwrapRes = buildUnwrapTextEdit(ast, code, nl, first);
  return unwrapRes.ok
    ? ok({ edits: unwrapRes.value.edits, warnings: unwrapRes.value.warnings, locsFromMarks: false })
    : unwrapRes;
}

export function planFileEdits(
  edit: StructureEdit,
  rel: string,
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  resolved: readonly ResolvedElement[],
  context?: PlanContext,
): Result<FilePlanResult> {
  if (edit.kind === 'insert') {
    return planInsert(ast, code, rel, nl, resolved, edit);
  }
  if (edit.kind === 'remove') {
    const remRes = buildRemoveTextEdits(ast, code, resolved);
    return remRes.ok ? ok({ edits: remRes.value, locsFromMarks: false }) : remRes;
  }
  if (edit.kind === 'duplicate') {
    const dupRes = buildDuplicateTextEdits(ast, code, nl, resolved);
    return dupRes.ok ? ok({ edits: dupRes.value, locsFromMarks: true }) : dupRes;
  }
  if (edit.kind === 'move') {
    return planMove(ast, code, rel, nl, resolved, edit, context);
  }
  return planWrapOrUnwrap(ast, code, nl, resolved, edit);
}
