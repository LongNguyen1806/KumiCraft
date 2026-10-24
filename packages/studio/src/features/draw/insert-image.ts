// Insert image operation (WP-2.09a, R-DT-13, R-DT-14).
import type { ImageSource, InsertTarget, Placement } from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { selectionAnchor } from '../design/selection-anchor.ts';
import { placementTailwindMajor } from '../editor/canvas-view-store.ts';
import { determineInsertTarget } from '../library/insert-block.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';

export type InsertImageChoice = {
  readonly image: ImageSource;
  readonly alt: string;
};

export type InsertImageOptions = {
  readonly className?: string | undefined;
  readonly placement?: Placement | undefined;
};

export type InsertImageResult =
  | { readonly ok: true; readonly locs: readonly string[] }
  | { readonly ok: false; readonly error?: ErrorInfo | undefined };

export async function insertImageAt(
  target: InsertTarget,
  choice: InsertImageChoice,
  opts?: InsertImageOptions,
): Promise<InsertImageResult> {
  const className = opts?.className ?? 'w-full h-auto';
  const placement = opts?.placement;
  const tailwindMajor = placementTailwindMajor(placement);

  try {
    const res = await applyStructureEdit({
      kind: 'insertImage',
      target,
      image: choice.image,
      alt: choice.alt,
      className,
      placement,
      tailwindMajor,
    });
    const newLoc = res.locs[0];
    if (newLoc !== undefined) {
      useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    }
    return { ok: true, locs: res.locs };
  } catch (err) {
    return { ok: false, error: toErrorInfo(err) };
  }
}

export async function insertImageFromSelection(
  choice: InsertImageChoice,
  opts?: InsertImageOptions,
): Promise<InsertImageResult> {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) {
    return { ok: false };
  }
  const ref = selectedRefs[0];
  if (!ref) {
    return { ok: false };
  }

  const resolved = selectionAnchor(ref);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const anchor = resolved.anchor;

  const tag = resolveTargetTag(anchor) ?? 'div';
  const target = determineInsertTarget(anchor, tag);
  return insertImageAt(target, choice, opts);
}
