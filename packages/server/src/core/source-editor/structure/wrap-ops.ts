// Text edit builders for wrap and unwrap operations (SPEC-04 R-SE-27, R-SE-28, section 4.3, 4.4).
import { err, ok, type Result } from '@reactcraft/shared';

import { asAstNode, type AstNode } from '../ast-helpers.ts';
import { jsxChildren } from './jsx-children.ts';
import { checkElementStructureGuard, findAncestors } from './structure-guard.ts';
import { fileIndentUnit, indentOf, lineStartOf, type ResolvedElement } from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';

const WRAP_CLASSES: Record<'row' | 'column' | 'grid', string> = {
  row: 'flex flex-row gap-4',
  column: 'flex flex-col gap-4',
  grid: 'grid grid-cols-2 gap-4',
};

function lineContentEndOf(code: string, pos: number): number {
  let i = pos;
  while (i < code.length && code[i] !== '\n' && code[i] !== '\r') i++;
  return i;
}

function checkWrapContiguous(parent: AstNode, sorted: readonly ResolvedElement[]): Result<void> {
  const siblings = jsxChildren(parent);
  const firstIdx = siblings.findIndex((s) => s.start === sorted[0]?.start);
  if (firstIdx === -1) {
    return err({ code: 'E016', params: { reason: 'notContiguous' } });
  }
  for (let i = 0; i < sorted.length; i++) {
    if (siblings[firstIdx + i]?.start !== sorted[i]?.start) {
      return err({ code: 'E016', params: { reason: 'notContiguous' } });
    }
  }
  return ok(undefined);
}

function buildWrappedContent(
  code: string,
  nl: '\r\n' | '\n',
  firstEl: ResolvedElement,
  lastEl: ResolvedElement,
  wrapper: 'row' | 'column' | 'grid',
): TextEdit {
  const unit = fileIndentUnit(code, firstEl.line);
  const I = indentOf(code, firstEl.start);
  const cls = WRAP_CLASSES[wrapper];

  const lineStart = lineStartOf(code, firstEl.start);
  const onlyWsBefore = /^[ \t]*$/.test(code.slice(lineStart, firstEl.start));
  const replaceStart = onlyWsBefore ? lineStart : firstEl.start;
  const replaceEnd = lastEl.end;

  const rawOld = code.slice(firstEl.start, lastEl.end);
  const oldLines = rawOld.split(/\r?\n/);
  const indentedOldLines = oldLines.map((line, idx) => {
    if (idx === 0) return `${I}${unit}${line}`;
    return line.trim() === '' ? '' : `${unit}${line}`;
  });

  const wrappedText =
    `${I}<div className="${cls}">${nl}` + `${indentedOldLines.join(nl)}${nl}` + `${I}</div>`;

  return {
    start: replaceStart,
    end: replaceEnd,
    text: wrappedText,
    mark: wrappedText.indexOf('<div'),
  };
}

export type WrapResult = {
  readonly edits: readonly TextEdit[];
};

export function buildWrapTextEdit(
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  elements: readonly ResolvedElement[],
  wrapper: 'row' | 'column' | 'grid',
): Result<WrapResult> {
  for (const el of elements) {
    const gRes = checkElementStructureGuard(ast, el.node, el.loc);
    if (!gRes.ok) return gRes;
  }

  const parents = elements.map((el) => {
    const ancestors = findAncestors(ast, el.node);
    return ancestors[ancestors.length - 1];
  });
  if (parents.some((p) => p === undefined) || parents.length === 0) {
    return err({ code: 'E016', params: { reason: 'notSameParent' } });
  }
  const parent = parents[0];
  if (!parent) return err({ code: 'E016', params: { reason: 'notSameParent' } });

  for (let i = 1; i < parents.length; i++) {
    if (parents[i] !== parent) {
      return err({ code: 'E016', params: { reason: 'notSameParent' } });
    }
  }

  const sorted = [...elements].sort((a, b) => a.start - b.start);
  const contigRes = checkWrapContiguous(parent, sorted);
  if (!contigRes.ok) return contigRes;

  const firstEl = sorted[0];
  const lastEl = sorted[sorted.length - 1];
  if (!firstEl || !lastEl) return err({ code: 'E016', params: { reason: 'empty' } });

  return ok({ edits: [buildWrappedContent(code, nl, firstEl, lastEl, wrapper)] });
}

export type UnwrapResult = {
  readonly edits: readonly TextEdit[];
  readonly warnings: readonly string[];
};

function checkHasOtherAttributes(opening: AstNode): boolean {
  const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  for (const attr of rawAttrs) {
    const attrNode = asAstNode(attr);
    if (!attrNode) continue;
    if (attrNode.type === 'JSXAttribute') {
      const nameNode = asAstNode(attrNode['name']);
      if (typeof nameNode?.['name'] === 'string' && nameNode['name'] !== 'className') {
        return true;
      }
    } else {
      return true;
    }
  }
  return false;
}

function unindentChildrenLines(lines: string[], unit: string): string[] {
  while (lines.length > 0 && lines[0]?.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();

  return lines.map((line) => {
    if (line.startsWith(unit)) return line.slice(unit.length);
    const wsMatch = /^[ \t]+/.exec(line);
    if (wsMatch) {
      const toRemove = Math.min(wsMatch[0].length, unit.length);
      return line.slice(toRemove);
    }
    return line;
  });
}

function buildUnwrapReplacement(
  code: string,
  nl: '\r\n' | '\n',
  element: ResolvedElement,
  unindented: readonly string[],
): TextEdit {
  const lineStart = lineStartOf(code, element.start);
  const lineEnd = lineContentEndOf(code, element.end);
  const onlyWsBefore = /^[ \t]*$/.test(code.slice(lineStart, element.start));
  const onlyWsAfter = /^[ \t]*$/.test(code.slice(element.end, lineEnd));

  if (onlyWsBefore && onlyWsAfter) {
    const afterNewline =
      code.slice(lineEnd, lineEnd + 2) === '\r\n'
        ? lineEnd + 2
        : code[lineEnd] === '\n'
          ? lineEnd + 1
          : lineEnd;
    return {
      start: lineStart,
      end: afterNewline,
      text: `${unindented.join(nl)}${nl}`,
    };
  }
  return {
    start: element.start,
    end: element.end,
    text: unindented.join(nl),
  };
}

export function buildUnwrapTextEdit(
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  element: ResolvedElement,
): Result<UnwrapResult> {
  const opening = element.opening;
  const tagNameNode = asAstNode(opening['name']);
  const tagName = typeof tagNameNode?.['name'] === 'string' ? tagNameNode['name'] : '';

  if (/^[A-Z]/.test(tagName)) {
    return err({ code: 'E023', params: { reason: 'componentTag', loc: element.loc } });
  }

  const children = jsxChildren(element.node);
  if (children.length === 0) {
    return err({ code: 'E016', params: { reason: 'nothingToUnwrap' } });
  }
  if (children.length > 1) {
    const gRes = checkElementStructureGuard(ast, element.node, element.loc);
    if (!gRes.ok) return gRes;
  }

  const openingEnd = opening.end;
  const closing = asAstNode(element.node['closingElement']);
  const closingStart = closing?.start;
  if (openingEnd === undefined || closingStart === undefined) {
    return err({ code: 'E024', params: { line: element.line, column: 1 } });
  }

  const warnings: string[] = checkHasOtherAttributes(opening) ? ['attributesDropped'] : [];
  const innerRaw = code.slice(openingEnd, closingStart);
  const unit = fileIndentUnit(code, element.line);
  const unindented = unindentChildrenLines(innerRaw.split(/\r?\n/), unit);
  const edit = buildUnwrapReplacement(code, nl, element, unindented);

  return ok({ edits: [edit], warnings });
}
