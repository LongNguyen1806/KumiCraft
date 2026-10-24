import type { ElementRef } from '@kumicraft/shared';

export type ClickModifiers = {
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
};

/**
 * Counts direct bridge children under an element without passing through another bridge node.
 */
function countDirectBridgeChildren(parent: Element): number {
  let count = 0;

  function walk(curr: Element) {
    for (let i = 0; i < curr.children.length; i++) {
      const child = curr.children[i];
      if (!child) continue;
      if (child.hasAttribute('data-rc-loc')) {
        count++;
      } else {
        walk(child);
      }
    }
  }

  walk(parent);
  return count;
}

/**
 * Computes candidate chain from the outermost element with `data-rc-loc` down to the target (R-SL-01).
 * Returns array ordered [outermost, ..., target].
 */
export function getCandidateChain(target: Element): Element[] {
  const chain: Element[] = [];
  let curr: Element | undefined = target.closest('[data-rc-loc]') ?? undefined;

  while (curr) {
    chain.unshift(curr);
    curr = curr.parentElement?.closest('[data-rc-loc]') ?? undefined;
  }

  return chain;
}

/**
 * Finds the Root of a candidate chain according to R-SL-01:
 * "Gốc = phần tử ngoài cùng của chuỗi có ít nhất hai phần tử con mang data-rc-loc;
 * không có thì gốc là phần tử ngoài cùng."
 */
export function findChainRoot(chain: readonly Element[]): Element | undefined {
  if (chain.length === 0) return undefined;

  for (const el of chain) {
    if (countDirectBridgeChildren(el) >= 2) {
      return el;
    }
  }

  return chain[0];
}

/**
 * Computes the next selected element on a normal click according to R-SL-02:
 * (a) S is ancestor of target -> select next element in chain after S.
 * (b) Parent of S is ancestor of target -> select element in chain that is child of parent of S.
 * (c) Otherwise -> select element immediately after root in chain (or root if root is deepest).
 * Exception: S is already deepest and clicked again -> retain S.
 */
export function computeNextSelected(
  chain: readonly Element[],
  currentSelected?: Element,
): Element | undefined {
  if (chain.length === 0) return undefined;
  if (chain.length === 1) return chain[0];

  const deepest = chain[chain.length - 1];
  if (!deepest) return undefined;

  // S is already deepest and clicked again: retain S
  if (currentSelected === deepest) {
    return deepest;
  }

  // (a) S is ancestor of target (in chain and not deepest)
  if (currentSelected) {
    const sIdx = chain.indexOf(currentSelected);
    if (sIdx !== -1 && sIdx < chain.length - 1) {
      return chain[sIdx + 1];
    }

    // (b) Parent of S is ancestor of target (in chain)
    const parentOfS = currentSelected.parentElement?.closest('[data-rc-loc]');
    if (parentOfS) {
      const pIdx = chain.indexOf(parentOfS);
      if (pIdx !== -1 && pIdx < chain.length - 1) {
        return chain[pIdx + 1];
      }
    }
  }

  // (c) Otherwise: select element immediately after root in chain
  const root = findChainRoot(chain);
  if (root) {
    const rootIdx = chain.indexOf(root);
    if (rootIdx !== -1 && rootIdx < chain.length - 1) {
      return chain[rootIdx + 1];
    }
    return root;
  }

  return deepest;
}

/**
 * Converts a DOM element to an ElementRef with loc and instance index.
 */
export function getRefForElement(el: Element, doc: Document = document): ElementRef | undefined {
  const loc = el.getAttribute('data-rc-loc');
  if (!loc) return undefined;

  const matches = doc.querySelectorAll(`[data-rc-loc="${loc}"]`);
  let index = 0;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i] === el) {
      index = i;
      break;
    }
  }

  return { loc, index };
}

/**
 * Checks if two ElementRefs refer to the exact same element.
 */
export function areRefsEqual(a: ElementRef, b: ElementRef): boolean {
  return a.loc === b.loc && a.index === b.index;
}

/**
 * Handles element selection for a click event, taking modifiers (Ctrl, Cmd, Shift) into account (R-SL-01..03).
 */
export function handleElementClick(
  target: Element,
  currentRefs: readonly ElementRef[],
  modifiers: ClickModifiers,
  doc: Document = document,
): ElementRef[] {
  const chain = getCandidateChain(target);
  if (chain.length === 0) return [];

  // Ctrl / Cmd + Click: select deepest element (R-SL-03)
  if (modifiers.ctrlKey || modifiers.metaKey) {
    const deepest = chain[chain.length - 1];
    if (!deepest) return [];
    const ref = getRefForElement(deepest, doc);
    return ref ? [ref] : [];
  }

  // Find currently selected element matching the last selected ref (primary selection, R-SL-05)
  const lastRef = currentRefs[currentRefs.length - 1];
  let currentSelectedEl: Element | undefined;
  if (lastRef) {
    const matches = doc.querySelectorAll(`[data-rc-loc="${lastRef.loc}"]`);
    currentSelectedEl = matches[lastRef.index];
  }

  const nextSelectedEl = computeNextSelected(chain, currentSelectedEl);
  if (!nextSelectedEl) return [];

  const nextRef = getRefForElement(nextSelectedEl, doc);
  if (!nextRef) return [];

  // Shift + Click: toggle in selection (R-SL-03)
  if (modifiers.shiftKey) {
    const alreadySelected = currentRefs.some((r) => areRefsEqual(r, nextRef));
    if (alreadySelected) {
      return currentRefs.filter((r) => !areRefsEqual(r, nextRef));
    }
    return [...currentRefs, nextRef];
  }

  // Normal click
  return [nextRef];
}
