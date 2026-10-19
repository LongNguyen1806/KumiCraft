// Placement for duplicate and paste landing inside a free frame (R-FF-12).
import type { InsertTarget, Placement } from '@reactcraft/shared';
import { FREE_STACK_OFFSET_PX, readClassPx } from '@reactcraft/shared';

import { fetchElementSourceByLoc } from '../../api/source-client.ts';
import { freeFrameOfRef } from './free-context.ts';

async function staticClassOf(loc: string): Promise<string> {
  const source = await fetchElementSourceByLoc(loc);
  return source?.className.kind === 'static' ? source.className.value : '';
}

/**
 * When `target` puts new elements into a free frame, returns a `free` placement 16 px right and
 * down from the anchor (the sibling at `target.ref`, or the frame's origin for a child insert).
 * Anything else, including a failed lookup, keeps the pasted classes untouched (`undefined`).
 */
export async function freeStackPlacement(target: InsertTarget): Promise<Placement | undefined> {
  try {
    let anchorClass = '';
    if (target.kind === 'child') {
      const parent = await fetchElementSourceByLoc(target.parent.loc);
      if (parent?.free !== true) return undefined;
    } else {
      const frame = await freeFrameOfRef(target.ref);
      if (!frame) return undefined;
      anchorClass = await staticClassOf(target.ref.loc);
    }

    return {
      kind: 'free',
      left: (readClassPx(anchorClass, 'left') ?? 0) + FREE_STACK_OFFSET_PX,
      top: (readClassPx(anchorClass, 'top') ?? 0) + FREE_STACK_OFFSET_PX,
    };
  } catch {
    return undefined;
  }
}
