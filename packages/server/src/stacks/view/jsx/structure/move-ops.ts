// Text edit builders for move operations (SPEC-04 R-SE-24, section 4.2).
import { err, ok, type Placement, type Result } from '@kumicraft/shared';

import type { AstNode } from '../../../../lib/ast-helpers.ts';
import { extractElementText } from './element-text.ts';
import { jsxChildren } from './jsx-children.ts';
import { applyPlacementToJsx } from './placement-jsx.ts';
import { checkElementStructureGuard, findAncestors } from './structure-guard.ts';
import {
  buildInsertTextEdit,
  buildRemoveTextEdits,
  type ResolvedElement,
} from './structure-ops.ts';
import type { TextEdit } from './text-edits.ts';

/**
 * Validates that all elements share the same parent node in AST.
 */
function validateSameParent(ast: AstNode, elements: readonly ResolvedElement[]): Result<AstNode> {
  const parents = elements.map((el) => {
    const ancestors = findAncestors(ast, el.node);
    return ancestors[ancestors.length - 1];
  });
  if (parents.some((p) => p === undefined) || parents.length === 0) {
    return err({ code: 'E016', params: { reason: 'notSameParent' } });
  }
  const first = parents[0];
  if (!first) {
    return err({ code: 'E016', params: { reason: 'notSameParent' } });
  }
  for (let i = 1; i < parents.length; i++) {
    if (parents[i] !== first) {
      return err({ code: 'E016', params: { reason: 'notSameParent' } });
    }
  }
  return ok(first);
}

/**
 * Validates that target is not inside or equal to any of the moving elements.
 */
function validateMoveIntoSelf(
  elements: readonly ResolvedElement[],
  targetNode: AstNode,
  targetKind: 'sibling' | 'child',
): Result<void> {
  for (const el of elements) {
    if (targetKind === 'child' && targetNode === el.node) {
      return err({ code: 'E016', params: { reason: 'moveIntoSelf' } });
    }
    if (
      targetNode.start !== undefined &&
      targetNode.end !== undefined &&
      el.start <= targetNode.start &&
      targetNode.end <= el.end
    ) {
      return err({ code: 'E016', params: { reason: 'moveIntoSelf' } });
    }
  }
  return ok(undefined);
}

export type SameFileMoveEdits = {
  readonly edits: readonly TextEdit[];
};

function tryAdjacentSiblingSwap(
  parent: AstNode,
  code: string,
  element: ResolvedElement,
  targetElement: ResolvedElement,
  where: 'before' | 'after',
): SameFileMoveEdits | undefined {
  const siblings = jsxChildren(parent);
  const idxA = siblings.findIndex((s) => s.start === element.start);
  const idxB = siblings.findIndex((s) => s.start === targetElement.start);
  if (idxA === -1 || idxB === -1) return undefined;

  const isAdjacentAfter = where === 'after' && idxB === idxA + 1;
  const isAdjacentBefore = where === 'before' && idxB === idxA - 1;
  if (!isAdjacentAfter && !isAdjacentBefore) return undefined;

  const firstEl = isAdjacentAfter ? element : targetElement;
  const secondEl = isAdjacentAfter ? targetElement : element;
  const firstText = code.slice(firstEl.start, firstEl.end);
  const separator = code.slice(firstEl.end, secondEl.start);
  const secondText = code.slice(secondEl.start, secondEl.end);
  const swappedText = `${secondText}${separator}${firstText}`;

  const mark = isAdjacentAfter
    ? secondText.length + separator.length + Math.max(0, firstText.indexOf('<'))
    : Math.max(0, secondText.indexOf('<'));

  return {
    edits: [
      {
        start: firstEl.start,
        end: secondEl.end,
        text: swappedText,
        mark,
      },
    ],
  };
}

/** Guards of a same-file move; returns the elements' shared parent. */
function validateMovable(
  ast: AstNode,
  elements: readonly ResolvedElement[],
  targetElement: ResolvedElement,
  targetKind: 'sibling' | 'child',
): Result<AstNode> {
  for (const el of elements) {
    const gRes = checkElementStructureGuard(ast, el.node, el.loc);
    if (!gRes.ok) return gRes;
  }
  const parentRes = validateSameParent(ast, elements);
  if (!parentRes.ok) return parentRes;
  const intoSelfRes = validateMoveIntoSelf(elements, targetElement.node, targetKind);
  if (!intoSelfRes.ok) return intoSelfRes;
  return parentRes;
}

export function buildSameFileMoveEdits(
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  elements: readonly ResolvedElement[],
  targetKind: 'sibling' | 'child',
  where: 'before' | 'after' | 'start' | 'end',
  targetElement: ResolvedElement,
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Result<SameFileMoveEdits> {
  // 1–3. Guards, one shared parent, not into itself
  const parentRes = validateMovable(ast, elements, targetElement, targetKind);
  if (!parentRes.ok) return parentRes;

  // Optimized swap for adjacent siblings under the same parent to preserve separators verbatim
  const singleEl = elements.length === 1 ? elements[0] : undefined;
  const swap =
    !placement && singleEl && targetKind === 'sibling' && (where === 'before' || where === 'after')
      ? tryAdjacentSiblingSwap(parentRes.value, code, singleEl, targetElement, where)
      : undefined;
  if (swap) return ok(swap);

  // 4. Sort elements by position in file
  const sorted = [...elements].sort((a, b) => a.start - b.start);

  // 5. Build moving JSX text with placement
  const movingText = sorted.map((el) => extractElementText(code, el)).join(nl);
  const movingJsxRes = applyPlacementToJsx(movingText, placement, tailwindMajor);
  if (!movingJsxRes.ok) return movingJsxRes;
  const movingJsx = movingJsxRes.value;

  // 6. Build remove edits
  const removeEditsRes = buildRemoveTextEdits(ast, code, sorted);
  if (!removeEditsRes.ok) return removeEditsRes;

  // 7. Build insert edit
  const insertEditRes = buildInsertTextEdit(
    ast,
    code,
    nl,
    targetKind,
    where,
    targetElement,
    movingJsx,
  );
  if (!insertEditRes.ok) return insertEditRes;

  const insertEdit = insertEditRes.value;
  const inPlace = inPlaceMove(
    sorted,
    removeEditsRes.value,
    insertEdit,
    code,
    placement,
    tailwindMajor,
  );
  if (inPlace) return inPlace;
  const allEdits = [...removeEditsRes.value, insertEdit];
  return ok({ edits: allEdits });
}

/**
 * A single element dropped where it already is (its own parent's end when it is the last child,
 * for example: a free frame child dragged inside its frame) lands inside its own removed range, so
 * remove and insert would overlap (E016). It stays put; only its JSX is rewritten, which applies
 * a placement or, without one, leaves the file as it was.
 */
function inPlaceMove(
  sorted: readonly ResolvedElement[],
  removeEdits: readonly TextEdit[],
  insertEdit: TextEdit,
  code: string,
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Result<SameFileMoveEdits> | undefined {
  const el = sorted[0];
  if (sorted.length !== 1 || el === undefined || removeEdits.length === 0) return undefined;
  const removeStart = Math.min(...removeEdits.map((e) => e.start));
  const removeEnd = Math.max(...removeEdits.map((e) => e.end));
  if (insertEdit.start < removeStart || insertEdit.start > removeEnd) return undefined;
  // The element's own text, indentation untouched: it does not move to another depth.
  const placed = applyPlacementToJsx(code.slice(el.start, el.end), placement, tailwindMajor);
  if (!placed.ok) return placed;
  return ok({ edits: [{ start: el.start, end: el.end, text: placed.value, mark: 0 }] });
}
