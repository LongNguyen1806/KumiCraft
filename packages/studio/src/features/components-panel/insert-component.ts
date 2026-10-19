// Component insertion logic (SPEC-04 R-CP-11..13, spec-log #23).
import type { InsertTarget, Placement, ProjectComponent } from '@reactcraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { useDesignStore } from '../design/design-store.ts';
import { insertAnchor } from '../design/design-target.ts';
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
      jsx: `<${component.name} />`,
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

  const treeNodes = useSelectionStore.getState().treeNodes;
  const designFile = useDesignStore.getState().target?.file;
  if (designFile !== undefined && component.file === designFile) {
    return { ok: false, skipped: true };
  }

  const anchor = insertAnchor(ref, treeNodes, designFile);
  if (!anchor) {
    return {
      ok: false,
      error: {
        code: 'design.selectInFile',
        params: { file: designFile ?? '' },
      },
    };
  }

  const tag = resolveTargetTag(anchor) ?? 'div';
  const target = determineInsertTarget(anchor, tag);
  return insertComponentAt(component, target);
}
