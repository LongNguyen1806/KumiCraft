// Insert an offline Lucide <svg> icon at the current Canvas selection (K9.7-2 TK-6).
import type { Placement } from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { selectionAnchor } from '../design/selection-anchor.ts';
import { determineInsertTarget } from '../library/insert-block.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';
import { buildIconJsx, type IconEntry } from './icon-svg.ts';

export type InsertIconResult =
  | { readonly ok: true; readonly locs: readonly string[] }
  | { readonly ok: false; readonly error?: ErrorInfo | undefined };

export async function insertIconFromSelection(
  icon: IconEntry,
  opts?: { readonly placement?: Placement | undefined; readonly tailwindMajor?: 3 | 4 | undefined },
): Promise<InsertIconResult> {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) return { ok: false };
  const ref = selectedRefs[0];
  if (!ref) return { ok: false };

  const resolved = selectionAnchor(ref);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const anchor = resolved.anchor;

  const tag = resolveTargetTag(anchor) ?? 'div';
  const target = determineInsertTarget(anchor, tag);
  const jsx = buildIconJsx(icon);

  try {
    const res = await applyStructureEdit({
      kind: 'insert',
      target,
      jsx,
      placement: opts?.placement,
      tailwindMajor: opts?.tailwindMajor,
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
