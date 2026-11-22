// Link and unwrap operations for SelectGroup (K9.8-1 TK-73).
import type {
  InteractionResult,
  LinkSelectContentAction,
  RemoveSelectGroupAction,
  Result,
} from '@kumicraft/shared';
import { err, ok, parseLocString } from '@kumicraft/shared';

import type { WrittenFile } from '../../../../kernel/editing.ts';
import { commitFileChanges } from '../../../../kernel/file-writer.ts';
import type { AstNode } from '../../../../lib/ast-helpers.ts';
import { asAstNode, getJsxTagName, parseJsxAst } from '../../../../lib/ast-helpers.ts';
import { cacheAst, computeSha256, findNodeAt } from '../source-editor-lookup.ts';
import { extractElementText } from './element-text.ts';
import {
  readAttrsExcluding,
  readJsxAttrString,
  restoreElementFromSelectItem,
  tagOf,
} from './select-group-helpers.ts';
import type { InteractionOpsDeps, ParsedSourceFile } from './select-group-ops.ts';
import { readParsedJsx, writeWithKitAndNotify } from './select-group-ops.ts';
import { findAncestors } from './structure-guard.ts';
import { indentOf } from './structure-ops.ts';
import { applyTextEdits, type TextEdit } from './text-edits.ts';

function collectSelectItemsInSubtree(rootNode: AstNode): { value: string; node: AstNode }[] {
  const items: { value: string; node: AstNode }[] = [];
  function walk(n: unknown) {
    const ast = asAstNode(n);
    if (!ast) return;
    if (ast.type === 'JSXElement') {
      const opening = asAstNode(ast['openingElement']);
      if (opening && getJsxTagName(opening) === 'SelectItem') {
        const fallback = `item-${String(items.length + 1)}`;
        items.push({ value: readJsxAttrString(opening, 'value') ?? fallback, node: ast });
        return;
      }
    }
    for (const k of Object.keys(ast)) {
      if (k === 'loc' || k === 'comments' || k === 'tokens') continue;
      const v = ast[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  }
  walk(rootNode);
  return items;
}

function findLowestCommonAncestor(
  grpAncestors: readonly AstNode[],
  tgtAncestors: readonly AstNode[],
): AstNode | undefined {
  let lca: AstNode | undefined;
  for (let i = 0; i < Math.min(grpAncestors.length, tgtAncestors.length); i++) {
    if (grpAncestors[i] === tgtAncestors[i]) lca = grpAncestors[i];
    else break;
  }
  return lca;
}

/**
 * Copies of the linked content get their own ids (`hero-2`, `hero-3`...), and labels follow them,
 * so the page never has two elements with one id (QA K9.8-1).
 */
export function withPanelIds(text: string, index: number): string {
  if (index === 0) return text;
  const suffix = `-${String(index + 1)}`;
  return text.replace(
    /(?<=\s)(id|htmlFor)="([^"]+)"/g,
    (_m, attr: string, value: string) => `${attr}="${value}${suffix}"`,
  );
}

function formatSelectPanels(options: {
  readonly code: string;
  readonly newline: '\r\n' | '\n';
  readonly tgtNode: AstNode;
  readonly tgtLocStr: string;
  readonly tgtLine: number;
  readonly selectItems: readonly { readonly value: string; readonly node: AstNode }[];
}): string {
  const { code, newline, tgtNode, tgtLocStr, tgtLine, selectItems } = options;
  const targetIndent = indentOf(code, tgtNode.start ?? 0);
  const targetFormatted = extractElementText(code, {
    loc: tgtLocStr,
    node: tgtNode,
    opening: asAstNode(tgtNode['openingElement']) ?? tgtNode,
    start: tgtNode.start ?? 0,
    end: tgtNode.end ?? 0,
    line: tgtLine,
  });
  return selectItems
    .map((it, idx) => {
      const body = withPanelIds(targetFormatted, idx)
        .split('\n')
        .map((l) => (l.length > 0 ? `${targetIndent}  ${l}` : ''))
        .join(newline);
      return `${idx === 0 ? '' : targetIndent}<SelectPanel value="${it.value}">${newline}${body}${newline}${targetIndent}</SelectPanel>`;
    })
    .join(newline);
}

type LcaWrapOptions = {
  readonly ast: AstNode;
  readonly code: string;
  readonly newline: '\r\n' | '\n';
  readonly grpNode: AstNode;
  readonly tgtNode: AstNode;
  readonly grpOpening: AstNode | undefined;
  readonly grpOpenEnd: number;
  readonly grpCloseStart: number;
  readonly panelsText: string;
};

/** The target already sits inside the group: its panels replace it in place. */
function inGroupLinkEdits(opts: LcaWrapOptions): TextEdit[] {
  const { code, tgtNode, grpOpening, grpOpenEnd, panelsText } = opts;
  const edits: TextEdit[] = [
    { start: tgtNode.start ?? 0, end: tgtNode.end ?? 0, text: panelsText },
  ];
  if (!code.slice(grpOpening?.start ?? 0, grpOpenEnd).includes('linked')) {
    edits.push({ start: grpOpenEnd - 1, end: grpOpenEnd, text: ' linked>' });
  }
  return edits;
}

/** The source range covering the two children of `lca` that hold the group and the target. */
function commonSpan(
  grpAncestors: readonly AstNode[],
  tgtAncestors: readonly AstNode[],
  lca: AstNode | undefined,
  grpNode: AstNode,
  tgtNode: AstNode,
): { readonly spanStart: number; readonly spanEnd: number } {
  const childOf = (ancestors: readonly AstNode[], fallback: AstNode) =>
    ancestors.find((_a, idx) => idx > 0 && ancestors[idx - 1] === lca) ?? fallback;
  const lcaChildGrp = childOf(grpAncestors, grpNode);
  const lcaChildTgt = childOf(tgtAncestors, tgtNode);
  return {
    spanStart: Math.min(
      lcaChildGrp.start ?? grpNode.start ?? 0,
      lcaChildTgt.start ?? tgtNode.start ?? 0,
    ),
    spanEnd: Math.max(lcaChildGrp.end ?? grpNode.end ?? 0, lcaChildTgt.end ?? grpNode.end ?? 0),
  };
}

function buildCrossBranchSelectEdits(opts: LcaWrapOptions): TextEdit[] {
  const {
    ast,
    code,
    newline,
    grpNode,
    tgtNode,
    grpOpening,
    grpOpenEnd,
    grpCloseStart,
    panelsText,
  } = opts;
  const grpAncestors = findAncestors(ast, grpNode);
  const tgtAncestors = findAncestors(ast, tgtNode);
  const lca = findLowestCommonAncestor(grpAncestors, tgtAncestors);
  if (lca === grpNode) return inGroupLinkEdits(opts);
  const existingProps = grpOpening ? readAttrsExcluding(grpOpening, code, new Set(['linked'])) : [];
  const { spanStart, spanEnd } = commonSpan(grpAncestors, tgtAncestors, lca, grpNode, tgtNode);
  const baseIndent = indentOf(code, spanStart);
  return [
    {
      start: grpNode.start ?? 0,
      end: grpNode.end ?? 0,
      text: code.slice(grpOpenEnd, grpCloseStart).trim(),
    },
    { start: tgtNode.start ?? 0, end: tgtNode.end ?? 0, text: panelsText },
    {
      start: spanStart,
      end: spanStart,
      text: `<SelectGroup ${['linked', ...existingProps].join(' ')}>${newline}${baseIndent}`,
    },
    { start: spanEnd, end: spanEnd, text: `${newline}${baseIndent}</SelectGroup>` },
  ];
}

function buildLinkPanelsEdits(options: {
  readonly parsed: ParsedSourceFile;
  readonly grpNode: AstNode;
  readonly tgtNode: AstNode;
  readonly tgtLocStr: string;
  readonly tgtLine: number;
  readonly selectItems: readonly { readonly value: string; readonly node: AstNode }[];
}): TextEdit[] {
  const { parsed, grpNode, tgtNode, tgtLocStr, tgtLine, selectItems } = options;
  const { ast, code, newline } = parsed;
  const grpOpening = asAstNode(grpNode['openingElement']);
  const grpOpenEnd = grpOpening?.end ?? grpNode.start ?? 0;
  const grpCloseStart = asAstNode(grpNode['closingElement'])?.start ?? grpNode.end ?? 0;
  const panelsText = formatSelectPanels({
    code,
    newline,
    tgtNode,
    tgtLocStr,
    tgtLine,
    selectItems,
  });
  return buildCrossBranchSelectEdits({
    ast,
    code,
    newline,
    grpNode,
    tgtNode,
    grpOpening,
    grpOpenEnd,
    grpCloseStart,
    panelsText,
  });
}

/**
 * The SelectGroup at `node`, around it or right inside it: the Studio may send the loc of the group,
 * of one of its items, or of their container (the group itself renders no element on the Canvas).
 */
function selectGroupAround(ast: AstNode, node: AstNode | undefined): AstNode | undefined {
  if (!node) return undefined;
  if (tagOf(node) === 'SelectGroup') return node;
  const around = findAncestors(ast, node)
    .reverse()
    .find((a) => a.type === 'JSXElement' && tagOf(a) === 'SelectGroup');
  return around ?? childSelectGroup(node);
}

/** A SelectGroup among the direct JSX children of a container (the user selected the container). */
function childSelectGroup(node: AstNode): AstNode | undefined {
  const children = Array.isArray(node['children']) ? node['children'] : [];
  return children
    .map((child) => asAstNode(child))
    .find((child) => child?.type === 'JSXElement' && tagOf(child) === 'SelectGroup');
}

export async function applyLinkSelectContent(
  deps: InteractionOpsDeps,
  root: string,
  action: LinkSelectContentAction,
): Promise<Result<InteractionResult>> {
  const grpLoc = parseLocString(action.group.loc);
  const tgtLoc = parseLocString(action.target.loc);
  if (!grpLoc || !tgtLoc || grpLoc.file !== tgtLoc.file) {
    return err({ code: 'E023', params: { reason: 'differentFiles' } });
  }
  const loaded = await readParsedJsx(deps.fs, root, grpLoc.file);
  if (!loaded.ok) return loaded;
  const grpNode = selectGroupAround(
    loaded.value.ast,
    findNodeAt(loaded.value.ast, grpLoc.line, grpLoc.column),
  );
  const tgtNode = findNodeAt(loaded.value.ast, tgtLoc.line, tgtLoc.column);
  if (!grpNode || !tgtNode)
    return err({ code: 'E017', params: { loc: action.group.loc, reason: 'moved' } });
  const selectItems = collectSelectItemsInSubtree(grpNode);
  if (selectItems.length === 0) return err({ code: 'E023', params: { reason: 'noSelectItems' } });
  const edits = buildLinkPanelsEdits({
    parsed: loaded.value,
    grpNode,
    tgtNode,
    tgtLocStr: action.target.loc,
    tgtLine: tgtLoc.line,
    selectItems,
  });
  const written = await writeWithKitAndNotify({
    deps,
    root,
    parsed: loaded.value,
    edits,
    kitComponents: ['SelectGroup', 'SelectItem', 'SelectPanel'],
    historyKey: 'history:linkSelectContent',
  });
  if (!written.ok) return written;
  return ok({
    changed: true,
    files: written.value.map((f) => f.path),
    locs: [action.group.loc],
    itemValues: selectItems.map((i) => i.value),
  });
}

function collectRemoveSelectEdits(grpNode: AstNode, code: string, isTailwind: boolean): TextEdit[] {
  const opening = asAstNode(grpNode['openingElement']);
  const closing = asAstNode(grpNode['closingElement']);
  const edits: TextEdit[] = [
    { start: grpNode.start ?? 0, end: opening?.end ?? grpNode.start ?? 0, text: '' },
    { start: closing?.start ?? grpNode.end ?? 0, end: grpNode.end ?? 0, text: '' },
  ];
  let firstPanelKept = false;
  function walk(n: unknown) {
    const astN = asAstNode(n);
    if (!astN) return;
    if (astN.type === 'JSXElement' && astN.start !== undefined && astN.end !== undefined) {
      const tag = tagOf(astN);
      if (tag === 'SelectItem') {
        const restored = restoreElementFromSelectItem(astN, code, isTailwind);
        if (restored.ok) edits.push({ start: astN.start, end: astN.end, text: restored.value });
        return;
      }
      if (tag === 'SelectPanel') {
        const pOpen = asAstNode(astN['openingElement']);
        const pClose = asAstNode(astN['closingElement']);
        if (!firstPanelKept && pOpen?.end !== undefined && pClose?.start !== undefined) {
          firstPanelKept = true;
          edits.push({ start: astN.start, end: pOpen.end, text: '' });
          edits.push({ start: pClose.start, end: astN.end, text: '' });
        } else {
          edits.push({ start: astN.start, end: astN.end, text: '' });
        }
        return;
      }
    }
    const children = Array.isArray(astN['children']) ? astN['children'] : [];
    children.forEach(walk);
  }
  const grpChildren = Array.isArray(grpNode['children']) ? grpNode['children'] : [];
  grpChildren.forEach(walk);
  return edits;
}

function stripUnusedSelectGroupImports(code: string): string {
  const withoutImportLines = code.replace(
    /^import\s*\{[^}]*\}\s*from\s*['"][^'"]*kumicraft\/SelectGroup['"];?\r?\n?/gm,
    '',
  );
  if (/\b(?:SelectGroup|SelectItem|SelectPanel)\b/.test(withoutImportLines)) {
    return code;
  }
  return withoutImportLines;
}

export async function applyRemoveSelectGroup(
  deps: InteractionOpsDeps,
  root: string,
  action: RemoveSelectGroupAction,
): Promise<Result<InteractionResult>> {
  const loc = parseLocString(action.group.loc);
  if (!loc) return err({ code: 'E016', params: { reason: 'invalidLoc' } });
  const loaded = await readParsedJsx(deps.fs, root, loc.file);
  if (!loaded.ok) return loaded;
  const grpNode = selectGroupAround(
    loaded.value.ast,
    findNodeAt(loaded.value.ast, loc.line, loc.column),
  );
  if (!grpNode) {
    return err({ code: 'E017', params: { loc: action.group.loc, reason: 'moved' } });
  }
  const useTailwind = action.styleSystem
    ? action.styleSystem === 'tailwind3' || action.styleSystem === 'tailwind4'
    : deps.styling?.primary === 'tailwind';
  const edits = collectRemoveSelectEdits(grpNode, loaded.value.code, useTailwind);
  const applied = applyTextEdits(loaded.value.code, edits);
  if (!applied.ok) return applied;
  const nextCode = stripUnusedSelectGroupImports(applied.value.code);
  const nextAst = parseJsxAst(nextCode);
  const finalText = loaded.value.hasBom ? `\uFEFF${nextCode}` : nextCode;
  const writeMain = await commitFileChanges({ fs: deps.fs }, root, [
    { path: loc.file, before: loaded.value.rawContent, after: finalText },
  ]);
  if (!writeMain.ok) return writeMain;
  const nextHash = computeSha256(finalText);
  cacheAst(loc.file, nextCode, nextHash, nextAst);
  const written: WrittenFile = {
    path: loc.file,
    before: loaded.value.rawContent,
    after: finalText,
    beforeHash: computeSha256(loaded.value.rawContent),
    afterHash: nextHash,
  };
  deps.onWritten?.([written], 'history:removeSelectGroup', 'SelectGroup');
  return ok({ changed: true, files: [loc.file], locs: [] });
}
