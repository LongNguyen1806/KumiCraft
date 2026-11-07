// Component insertion logic (SPEC-04 R-CP-11..13, spec-log #23).
import type { InsertTarget, Placement, ProjectComponent } from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { currentDesignFile } from '../design/design-store.ts';
import { selectionAnchor } from '../design/selection-anchor.ts';
import { determineInsertTarget } from '../library/insert-block.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';

export type InsertComponentResult =
  | { readonly ok: true; readonly locs: readonly string[] }
  | { readonly ok: false; readonly error?: ErrorInfo | undefined; readonly skipped?: boolean };

export async function insertComponentAt(
  component: ProjectComponent,
  target: InsertTarget,
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Promise<InsertComponentResult> {
  try {
    const res = await applyStructureEdit({
      kind: 'insert',
      target,
      // Required props come filled in, so the project still type-checks (K9.5).
      jsx: component.insertJsx ?? `<${component.name} />`,
      from: {
        file: component.file,
        imports: [component.importStatement],
      },
      placement,
      tailwindMajor,
    });
    if (res.warnings && res.warnings.length > 0) {
      useStructureErrorStore.getState().setWarnings(res.warnings);
    }
    const newLoc = res.locs[0];
    if (newLoc) {
      useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    }
    return { ok: true, locs: res.locs };
  } catch (err) {
    return { ok: false, error: toErrorInfo(err) };
  }
}

export async function insertComponent(component: ProjectComponent): Promise<InsertComponentResult> {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) {
    return { ok: false, skipped: true };
  }
  const ref = selectedRefs[0];
  if (!ref) {
    return { ok: false, skipped: true };
  }

  const designFile = currentDesignFile();
  if (designFile !== undefined && component.file === designFile) {
    return { ok: false, skipped: true };
  }

  const resolved = selectionAnchor(ref);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const anchor = resolved.anchor;

  const tag = resolveTargetTag(anchor) ?? 'div';
  const target = determineInsertTarget(anchor, tag);
  return insertComponentAt(component, target);
}
