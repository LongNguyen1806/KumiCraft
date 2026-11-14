// Plan building per file for structure operations (SPEC-04 R-SE-22..28).
import type { ElementGuard, Result, StructureEdit } from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';

import { asAstNode, type AstNode, getJsxTagName, parseJsxAst } from '../ast-helpers.ts';
import { findNodeAt, validateLocAndExt } from '../source-editor-lookup.ts';
import { collectComponentTags } from './element-text.ts';
import { buildMissingImportsEdits } from './imports.ts';
import { buildReplaceSvgEdits, buildWrapTextInlineEdits } from './inline-svg-ops.ts';
import { buildSameFileMoveEdits } from './move-ops.ts';
import { applyPlacementToJsx } from './placement-jsx.ts';
import {
  buildDuplicateTextEdits,
  buildInsertTextEdit,
  buildRemoveTextEdits,
  type ResolvedElement,
} from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';
import { insertsComponentIntoItself } from './top-level-declarations.ts';
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

function isHarmlessExpression(expr: AstNode | undefined): boolean {
  if (!expr) return true;
  if (expr.type === 'JSXEmptyExpression') return true;
  if (expr.type === 'StringLiteral' || expr.type === 'NumericLiteral') return true;
  if (
    expr.type === 'Literal' &&
    (typeof expr['value'] === 'string' || typeof expr['value'] === 'number')
  ) {
    return true;
  }
  return false;
}

function hasForeignExpression(root: AstNode): boolean {
  let found = false;
  const walk = (node: unknown) => {
    if (found || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const astNode = node as AstNode;
    if (astNode.type === 'JSXExpressionContainer') {
      const expr = asAstNode(astNode['expression']);
      if (!isHarmlessExpression(expr)) {
        found = true;
        return;
      }
    }
    for (const key of Object.keys(astNode)) {
      if (key !== 'parent' && key !== 'loc') {
        walk(astNode[key]);
      }
    }
  };
  walk(root);
  return found;
}

function tryParseFragment(jsx: string): AstNode | undefined {
  try {
    return parseJsxAst(`<>${jsx}</>`);
  } catch {
    return undefined;
  }
}

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

  let jsxToInsert = edit.jsx;
  if (edit.placement) {
    const placedRes = applyPlacementToJsx(edit.jsx, edit.placement, edit.tailwindMajor);
    if (!placedRes.ok) return placedRes;
    jsxToInsert = placedRes.value;
  }

  const insertEditRes = buildInsertTextEdit(
    ast,
    code,
    nl,
    edit.target.kind,
    edit.target.where,
    first,
    jsxToInsert,
  );
  if (!insertEditRes.ok) return insertEditRes;

  const astSnippet = tryParseFragment(jsxToInsert);
  const snippetTags = astSnippet ? collectComponentTags(astSnippet) : [];
  // A component dropped into its own code would render itself forever and hang the page.
  if (insertsComponentIntoItself(ast, snippetTags, insertEditRes.value.start)) {
    return err({ code: 'E016', params: { reason: 'componentIntoItself' } });
  }
  const neededIds =
    edit.dataArray !== undefined
      ? [...new Set([...snippetTags, edit.dataArray.exportName])]
      : snippetTags;
  const autoImports = buildMissingImportsEdits(ast, code, rel, neededIds, edit.from, nl);

  const warnings = [...autoImports.warnings];
  if (edit.from && edit.from.file !== rel && astSnippet && hasForeignExpression(astSnippet)) {
    if (!warnings.includes('foreignExpression')) {
      warnings.push('foreignExpression');
    }
  }

  return ok({
    edits: [...autoImports.edits, insertEditRes.value],
    warnings,
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

  let movingJsx = context.movingJsx;
  if (edit.placement) {
    const placedRes = applyPlacementToJsx(context.movingJsx, edit.placement, edit.tailwindMajor);
    if (!placedRes.ok) return placedRes;
    movingJsx = placedRes.value;
  }

  const insertEditRes = buildInsertTextEdit(
    ast,
    code,
    nl,
    edit.target.kind,
    edit.target.where,
    context.targetResolved,
    movingJsx,
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
      edit.placement,
      edit.tailwindMajor,
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
    const dupRes = buildDuplicateTextEdits(
      ast,
      code,
      nl,
      resolved,
      edit.placement,
      edit.tailwindMajor,
    );
    return dupRes.ok ? ok({ edits: dupRes.value, locsFromMarks: true }) : dupRes;
  }
  if (edit.kind === 'move') {
    return planMove(ast, code, rel, nl, resolved, edit, context);
  }
  if (edit.kind === 'wrap' || edit.kind === 'unwrap') {
    return planWrapOrUnwrap(ast, code, nl, resolved, edit);
  }
  if (edit.kind === 'wrapText') {
    const first = resolved[0];
    if (!first) return err({ code: 'E017', params: { loc: edit.loc, reason: 'moved' } });
    const inlineRes = buildWrapTextInlineEdits(code, first, edit);
    return inlineRes.ok ? ok({ edits: inlineRes.value, locsFromMarks: true }) : inlineRes;
  }
  if (edit.kind === 'replaceSvg') {
    const first = resolved[0];
    if (!first) return err({ code: 'E017', params: { loc: edit.loc, reason: 'moved' } });
    const svgRes = buildReplaceSvgEdits(code, nl, first, edit);
    return svgRes.ok ? ok({ edits: svgRes.value, locsFromMarks: false }) : svgRes;
  }
  return err({ code: 'E016', params: { reason: 'unsupportedStructureEdit' } });
}
