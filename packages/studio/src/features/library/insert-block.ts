// Block insertion logic (SPEC-04 R-LB-14, R-LB-15).
import type { ElementRef, InsertTarget, LibraryBlock } from '@reactcraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';

export const CONTAINER_TAGS = [
  'div',
  'section',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
  'article',
  'form',
  'fieldset',
  'ul',
  'ol',
] as const;

export function isContainerTag(tag: string): boolean {
  return CONTAINER_TAGS.includes(tag.toLowerCase() as (typeof CONTAINER_TAGS)[number]);
}

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

export async function insertBlock(block: LibraryBlock, lang: string): Promise<InsertBlockResult> {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) {
    return { ok: false, skipped: true };
  }
  const ref = selectedRefs[0];
  if (!ref) {
    return { ok: false, skipped: true };
  }

  const tag = resolveTargetTag(ref) ?? 'div';
  const target = determineInsertTarget(ref, tag);
  const jsx = lang.toLowerCase().startsWith('vi') ? block.jsx.vi : block.jsx.en;

  try {
    const res = await applyStructureEdit({ kind: 'insert', target, jsx });
    const newLoc = res.locs[0];
    if (newLoc) {
      useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    }
    return { ok: true, locs: res.locs };
  } catch (err) {
    return { ok: false, error: toErrorInfo(err) };
  }
}
