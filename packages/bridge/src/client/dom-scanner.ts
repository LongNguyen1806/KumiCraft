import type { BridgeTreePayload, TreeNode } from '@kumicraft/shared';

import { componentUseOf } from './component-use.ts';

/**
 * Extracts a label from an element according to R-SL-11:
 * - First CSS class without ':'
 * - Or first 24 characters of direct text content
 * - Or undefined
 */
export function extractElementLabel(el: Element): string | undefined {
  const classAttr = el.getAttribute('class');
  if (classAttr) {
    const classes = classAttr.split(/\s+/).filter(Boolean);
    const validClass = classes.find((c) => !c.includes(':'));
    if (validClass) {
      return validClass.length > 100 ? validClass.slice(0, 100) : validClass;
    }
  }

  // Check direct text nodes
  let directText = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node && node.nodeType === 3 /* TEXT_NODE */) {
      directText += node.textContent ?? '';
    }
  }

  const trimmed = directText.trim().replace(/\s+/g, ' ');
  if (trimmed.length > 0) {
    return trimmed.length > 24 ? trimmed.slice(0, 24) : trimmed;
  }

  return undefined;
}

/**
 * Recursively scans descendants of an element to find the immediate child elements
 * that have the `data-rc-loc` attribute, without traversing through other `data-rc-loc` nodes.
 */
export function findDirectBridgeChildren(parent: Element): Element[] {
  const result: Element[] = [];

  function walk(curr: Element) {
    for (let i = 0; i < curr.children.length; i++) {
      const child = curr.children[i];
      if (!child) continue;
      if (child.hasAttribute('data-rc-loc')) {
        result.push(child);
      } else {
        walk(child);
      }
    }
  }

  walk(parent);
  return result;
}

/**
 * Computes instances count and assigns 0-based indices for all matching elements.
 */
export function indexLocElements(root: Element): {
  counts: Map<string, number>;
  elementIndices: Map<Element, number>;
} {
  const counts = new Map<string, number>();
  const elementIndices = new Map<Element, number>();
  const elements = root.querySelectorAll('[data-rc-loc]');

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;
    const loc = el.getAttribute('data-rc-loc');
    if (loc) {
      const curr = counts.get(loc) ?? 0;
      elementIndices.set(el, curr);
      counts.set(loc, curr + 1);
    }
  }

  return { counts, elementIndices };
}

/**
 * Scans the DOM tree starting from `root` and builds flat `BridgeTreePayload`.
 * Complies with:
 * - R-BR-12 & V-113: Flat TreeNode[] with parent index. Subtree only for the first instance.
 * - R-SL-11: label from first class without ':' or 24 text chars.
 * - Max 5000 nodes with truncated flag.
 */
export function scanDomTree(root: Element = document.body, designFile?: string): BridgeTreePayload {
  const { counts, elementIndices } = indexLocElements(root);
  const nodes: TreeNode[] = [];

  function traverse(el: Element, parentIndex?: number) {
    if (nodes.length >= 5000) {
      return;
    }

    const loc = el.getAttribute('data-rc-loc');
    if (!loc) return;

    const instances = counts.get(loc) ?? 1;
    const index = elementIndices.get(el) ?? 0;
    const label = extractElementLabel(el);
    const component = componentUseOf(el, designFile);

    const myIndex = nodes.length;
    const node: TreeNode = {
      ref: { loc, index },
      tag: el.tagName.toLowerCase(),
      instances,
      ...(parentIndex !== undefined ? { parent: parentIndex } : {}),
      ...(label !== undefined ? { label } : {}),
      ...(component !== undefined ? { component } : {}),
    };
    nodes.push(node);

    // V-113: Only traverse subtree for the first instance (index === 0)
    if (index === 0) {
      const children = findDirectBridgeChildren(el);
      for (const child of children) {
        traverse(child, myIndex);
        if (nodes.length >= 5000) {
          break;
        }
      }
    }
  }

  const rootBridgeElements = root.hasAttribute('data-rc-loc')
    ? [root]
    : findDirectBridgeChildren(root);

  for (const el of rootBridgeElements) {
    traverse(el, undefined);
    if (nodes.length >= 5000) break;
  }

  return {
    nodes,
    ...(nodes.length >= 5000 ? { truncated: true } : {}),
  };
}
