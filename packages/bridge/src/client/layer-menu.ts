// Right-click "Chọn lớp": every element under the pointer, outermost first (SPEC-04 R-SL-13).
import type { BridgeLayerMenuPayload, LayerMenuItem } from '@kumicraft/shared';
import { parseLocString } from '@kumicraft/shared';

import { getCandidateChain, getRefForElement } from './candidate-chain.ts';
import { extractElementLabel } from './dom-scanner.ts';
import { getBridgeElementAtPoint } from './overlay-focus.ts';

const MAX_ITEMS = 30;

/**
 * Builds the `layer-menu` payload for a right-click at (x, y) in the iframe viewport. In component
 * focus mode only elements of the focused file are offered, as only they can be selected.
 */
export function buildLayerMenu(
  doc: Document,
  x: number,
  y: number,
  designFile?: string,
  focus = false,
): BridgeLayerMenuPayload | undefined {
  const target = getBridgeElementAtPoint(doc, x, y, designFile, focus);
  if (target === undefined) return undefined;
  const chain = getCandidateChain(target).filter((el) => {
    if (!focus || designFile === undefined) return true;
    return parseLocString(el.getAttribute('data-rc-loc') ?? '')?.file === designFile;
  });
  const items: LayerMenuItem[] = [];
  // Over 30 levels deep: keep the innermost ones, which are the hard ones to reach by clicking.
  for (const el of chain.slice(-MAX_ITEMS)) {
    const ref = getRefForElement(el, doc);
    if (ref === undefined) continue;
    const label = extractElementLabel(el);
    items.push({ ref, tag: el.localName, ...(label !== undefined ? { label } : {}) });
  }
  return items.length === 0 ? undefined : { x, y, items };
}
