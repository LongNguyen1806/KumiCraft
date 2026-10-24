// Block insertion logic (SPEC-04 R-LB-14, R-LB-15).
import {
  type ElementRef,
  type InsertTarget,
  isContainerTag,
  type LibraryBlock,
  type Placement,
} from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { selectionAnchor } from '../design/selection-anchor.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';

export function determineInsertTarget(ref: ElementRef, tag: string): InsertTarget {
  if (isContainerTag(tag)) {
    return {
      kind: 'child',
      parent: { loc: ref.loc, tag },
      where: 'end',
    };
  }
  return {
    kind: 'sibling',
    ref: { loc: ref.loc, tag },
    where: 'after',
  };
}

export type InsertBlockResult =
  | { readonly ok: true; readonly locs: readonly string[] }
  | { readonly ok: false; readonly error?: ErrorInfo | undefined; readonly skipped?: boolean };

export function localizedBlockJsx(block: LibraryBlock, lang: string): string {
  return lang.toLowerCase().startsWith('vi') ? block.jsx.vi : block.jsx.en;
}

export async function insertBlockAt(
  block: LibraryBlock,
  target: InsertTarget,
  lang: string,
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Promise<InsertBlockResult> {
  const jsx = localizedBlockJsx(block, lang);
  try {
    const res = await applyStructureEdit({ kind: 'insert', target, jsx, placement, tailwindMajor });
    const newLoc = res.locs[0];
    if (newLoc) {
      useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    }
    return { ok: true, locs: res.locs };
  } catch (err) {
    return { ok: false, error: toErrorInfo(err) };
  }
}

export async function insertBlock(block: LibraryBlock, lang: string): Promise<InsertBlockResult> {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) {
    return { ok: false, skipped: true };
  }
  const ref = selectedRefs[0];
  if (!ref) {
    return { ok: false, skipped: true };
  }

  const resolved = selectionAnchor(ref);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const anchor = resolved.anchor;

  const tag = resolveTargetTag(anchor) ?? 'div';
  const target = determineInsertTarget(anchor, tag);
  return insertBlockAt(block, target, lang);
}
