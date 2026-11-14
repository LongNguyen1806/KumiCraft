// "Show a notice on click" (K9.8-1 TK-76): wraps the element in ToastTrigger, one ToastHost per
// page unless a layout already has one, never next to the project's own notice system (QA K9.8-1).
import type {
  AddToastOnClickAction,
  InteractionResult,
  KitComponentId,
  Result,
} from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';

import type { AstNode } from '../ast-helpers.ts';
import { asAstNode, detectFormat, parseJsxAst } from '../ast-helpers.ts';
import { findNodeAt } from '../source-editor-lookup.ts';
import { escapeAttr, finishJsxKitEdit } from './interaction-kit-edit.ts';
import { tagOf } from './select-group-helpers.ts';
import type { InteractionOpsDeps } from './select-group-ops.ts';
import { findAncestors } from './structure-guard.ts';
import { indentOf } from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';
import { toastProjectState } from './toast-project-scan.ts';

function buildToastTriggerAttrs(a: AddToastOnClickAction): string {
  const parts = [`message="${escapeAttr(a.message)}"`];
  if (a.subtext !== undefined && a.subtext !== '') parts.push(`subtext="${escapeAttr(a.subtext)}"`);
  if (a.variant !== undefined) parts.push(`variant="${a.variant}"`);
  if (a.durationMs !== undefined) parts.push(`durationMs={${String(a.durationMs)}}`);
  if (a.position !== undefined) parts.push(`position="${a.position}"`);
  return parts.join(' ');
}

function hasToastHostTag(ast: AstNode): boolean {
  let found = false;
  function walk(n: unknown) {
    if (found) return;
    const node = asAstNode(n);
    if (!node) return;
    if (node.type === 'JSXElement' && tagOf(node) === 'ToastHost') {
      found = true;
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'comments' || k === 'tokens') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  }
  walk(ast['program']);
  return found;
}

function findRootJsxElement(ast: AstNode): AstNode | undefined {
  let rootEl: AstNode | undefined;
  function walk(n: unknown) {
    if (rootEl !== undefined) return;
    const node = asAstNode(n);
    if (!node) return;
    if (node.type === 'JSXElement' && asAstNode(node['closingElement']) !== undefined) {
      rootEl = node;
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'comments' || k === 'tokens') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  }
  walk(ast['program']);
  return rootEl;
}

function buildToastWrapEdits(
  ast: AstNode,
  node: AstNode,
  code: string,
  newline: '\r\n' | '\n',
  triggerAttrs: string,
  hostElsewhere: boolean,
): { readonly edits: readonly TextEdit[]; readonly kitComponents: readonly KitComponentId[] } {
  const edits: TextEdit[] = [];
  const parent = findAncestors(ast, node).at(-1);
  if (parent && parent.type === 'JSXElement' && tagOf(parent) === 'ToastTrigger') {
    const pOpen = asAstNode(parent['openingElement']);
    if (pOpen?.start !== undefined && pOpen.end !== undefined) {
      edits.push({ start: pOpen.start, end: pOpen.end, text: `<ToastTrigger ${triggerAttrs}>` });
    }
  } else if (node.start !== undefined && node.end !== undefined) {
    const ind = indentOf(code, node.start);
    const wrapped = `<ToastTrigger ${triggerAttrs}>${newline}${ind}  ${code.slice(node.start, node.end)}${newline}${ind}</ToastTrigger>`;
    edits.push({ start: node.start, end: node.end, text: wrapped });
  }
  const needsHost = !hostElsewhere && !hasToastHostTag(ast);
  if (needsHost) {
    const rootEl = findRootJsxElement(ast);
    const closing = rootEl ? asAstNode(rootEl['closingElement']) : undefined;
    if (closing?.start !== undefined) {
      const ind = indentOf(code, closing.start);
      edits.push({
        start: closing.start,
        end: closing.start,
        text: `${ind}  <ToastHost />${newline}${ind}`,
      });
    }
  }
  return { edits, kitComponents: needsHost ? ['ToastTrigger', 'ToastHost'] : ['ToastTrigger'] };
}

export async function applyAddToastOnClick(
  deps: InteractionOpsDeps,
  root: string,
  action: AddToastOnClickAction,
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
  const project = await toastProjectState(deps.fs, root, deps.sourceDir ?? 'src', loc.file);
  if (!project.ok) return project;
  const { edits, kitComponents } = buildToastWrapEdits(
    ast,
    node,
    code,
    newline,
    buildToastTriggerAttrs(action),
    project.value.hostElsewhere,
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
    kitComponents,
    historyKey: 'history:addToastOnClick',
    historyTag: action.element.tag,
  });
  if (!written.ok) return written;
  return ok({ changed: true, files: written.value.map((f) => f.path), locs: [action.element.loc] });
}
