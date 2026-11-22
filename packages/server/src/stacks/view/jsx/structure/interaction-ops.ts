// Interaction structure operations: LoadingButton, ScrollSpy, LinkTarget, and the dispatch of every
// interaction action (K9.8-1 TK-73..80).
import type {
  InteractionAction,
  InteractionResult,
  MakeLoadingButtonAction,
  MarkActiveNavAction,
  Result,
  SetLinkTargetAction,
} from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';

import type { AstNode } from '../../../../lib/ast-helpers.ts';
import {
  asAstNode,
  detectFormat,
  getJsxTagName,
  parseJsxAst,
} from '../../../../lib/ast-helpers.ts';
import { findNodeAt } from '../source-editor-lookup.ts';
import { escapeAttr, finishJsxKitEdit } from './interaction-kit-edit.ts';
import { buildLinkTargetEdits } from './interaction-link-helpers.ts';
import { readAttrsExcluding, tagOf } from './select-group-helpers.ts';
import { applyLinkSelectContent, applyRemoveSelectGroup } from './select-group-link-ops.ts';
import { applyMakeSelectGroup, type InteractionOpsDeps } from './select-group-ops.ts';
import { findAncestors } from './structure-guard.ts';
import { indentOf } from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';

/** `<button …>` (or an existing LoadingButton) rewritten as `<LoadingButton as="button" …>`. */
function loadingButtonEdits(
  node: AstNode,
  opening: AstNode,
  code: string,
  loadingText: string | undefined,
): TextEdit[] {
  const attrs = readAttrsExcluding(opening, code, new Set(['as', 'loadingText']));
  const loadingPart = loadingText ? [`loadingText="${escapeAttr(loadingText)}"`] : [];
  const nextAttrs = ['as="button"', ...loadingPart, ...attrs].join(' ');
  const edits: TextEdit[] = [
    { start: opening.start ?? 0, end: opening.end ?? 0, text: `<LoadingButton ${nextAttrs}>` },
  ];
  const closing = asAstNode(node['closingElement']);
  if (
    getJsxTagName(opening) === 'button' &&
    closing?.start !== undefined &&
    closing.end !== undefined
  ) {
    edits.push({ start: closing.start, end: closing.end, text: '</LoadingButton>' });
  }
  return edits;
}

async function applyMakeLoadingButton(
  deps: InteractionOpsDeps,
  root: string,
  action: MakeLoadingButtonAction,
): Promise<Result<InteractionResult>> {
  const loc = parseLocString(action.element.loc);
  if (!loc) return err({ code: 'E016', params: { reason: 'invalidLoc' } });
  const readRes = await deps.fs.readText(root, loc.file, { maxBytes: 1024 * 1024, keepBom: true });
  if (!readRes.ok) return readRes;
  const { hasBom, newline } = detectFormat(readRes.value);
  const code = hasBom ? readRes.value.slice(1) : readRes.value;
  const ast = parseJsxAst(code);
  const node = findNodeAt(ast, loc.line, loc.column);
  const opening = node ? asAstNode(node['openingElement']) : undefined;
  const tag = opening ? getJsxTagName(opening) : undefined;
  if (
    !node ||
    !opening ||
    opening.start === undefined ||
    opening.end === undefined ||
    (tag !== 'button' && tag !== 'LoadingButton')
  ) {
    return err({ code: 'E023', params: { reason: 'notButton' } });
  }

  const edits = loadingButtonEdits(node, opening, code, action.loadingText);
  const written = await finishJsxKitEdit({
    deps,
    root,
    file: loc.file,
    rawContent: readRes.value,
    code,
    hasBom,
    newline,
    ast,
    edits,
    kitComponents: ['LoadingButton'],
    historyKey: 'history:makeLoadingButton',
    historyTag: 'LoadingButton',
  });
  if (!written.ok) return written;
  return ok({ changed: true, files: written.value.map((f) => f.path), locs: [action.element.loc] });
}

async function applyMarkActiveNav(
  deps: InteractionOpsDeps,
  root: string,
  action: MarkActiveNavAction,
): Promise<Result<InteractionResult>> {
  const loc = parseLocString(action.element.loc);
  if (!loc) return err({ code: 'E016', params: { reason: 'invalidLoc' } });
  const readRes = await deps.fs.readText(root, loc.file, { maxBytes: 1024 * 1024, keepBom: true });
  if (!readRes.ok) return readRes;
  const { hasBom, newline } = detectFormat(readRes.value);
  const code = hasBom ? readRes.value.slice(1) : readRes.value;
  const ast = parseJsxAst(code);
  const node = findNodeAt(ast, loc.line, loc.column);
  if (!node || node.start === undefined || node.end === undefined) {
    return err({ code: 'E017', params: { loc: action.element.loc, reason: 'moved' } });
  }
  const parent = findAncestors(ast, node).at(-1);
  if (parent && parent.type === 'JSXElement' && tagOf(parent) === 'ScrollSpy') {
    return ok({ changed: false, files: [], locs: [action.element.loc] });
  }

  const ind = indentOf(code, node.start);
  const wrapped = `<ScrollSpy>${newline}${ind}  ${code.slice(node.start, node.end)}${newline}${ind}</ScrollSpy>`;
  const written = await finishJsxKitEdit({
    deps,
    root,
    file: loc.file,
    rawContent: readRes.value,
    code,
    hasBom,
    newline,
    ast,
    edits: [{ start: node.start, end: node.end, text: wrapped }],
    kitComponents: ['ScrollSpy'],
    historyKey: 'history:markActiveNav',
    historyTag: action.element.tag,
  });
  if (!written.ok) return written;
  return ok({ changed: true, files: written.value.map((f) => f.path), locs: [action.element.loc] });
}

async function applySetLinkTarget(
  deps: InteractionOpsDeps,
  root: string,
  action: SetLinkTargetAction,
): Promise<Result<InteractionResult>> {
  const loc = parseLocString(action.element.loc);
  if (!loc) return err({ code: 'E016', params: { reason: 'invalidLoc' } });
  const readRes = await deps.fs.readText(root, loc.file, { maxBytes: 1024 * 1024, keepBom: true });
  if (!readRes.ok) return readRes;
  const { hasBom, newline } = detectFormat(readRes.value);
  const code = hasBom ? readRes.value.slice(1) : readRes.value;
  const ast = parseJsxAst(code);
  const node = findNodeAt(ast, loc.line, loc.column);
  const opening = node ? asAstNode(node['openingElement']) : undefined;
  const curTag = opening ? getJsxTagName(opening) : undefined;
  if (!node || !opening || opening.start === undefined || opening.end === undefined || !curTag) {
    return err({ code: 'E017', params: { loc: action.element.loc, reason: 'moved' } });
  }
  const { nextTag, routerPkg, edits } = buildLinkTargetEdits(
    ast,
    node,
    opening,
    curTag,
    code,
    action,
  );
  const written = await finishJsxKitEdit({
    deps,
    root,
    file: loc.file,
    rawContent: readRes.value,
    code,
    hasBom,
    newline,
    ast,
    edits,
    kitComponents: [],
    extraImports:
      nextTag === 'Link' && routerPkg ? [`import { Link } from '${routerPkg}';`] : undefined,
    historyKey: 'history:setLinkTarget',
    historyTag: nextTag,
  });
  if (!written.ok) return written;
  return ok({ changed: true, files: written.value.map((f) => f.path), locs: [action.element.loc] });
}

export async function applyInteractionAction(
  deps: InteractionOpsDeps,
  root: string,
  action: InteractionAction,
): Promise<Result<InteractionResult>> {
  switch (action.action) {
    case 'makeSelectGroup':
      return applyMakeSelectGroup(deps, root, action);
    case 'linkSelectContent':
      return applyLinkSelectContent(deps, root, action);
    case 'removeSelectGroup':
      return applyRemoveSelectGroup(deps, root, action);
    case 'makeLoadingButton':
      return applyMakeLoadingButton(deps, root, action);
    case 'markActiveNav':
      return applyMarkActiveNav(deps, root, action);
    case 'setLinkTarget':
      return applySetLinkTarget(deps, root, action);
  }
}
