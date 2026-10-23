// Where an insert from the Library, the Component panel or the image picker goes (R-CP-11, R-LB-14).
import type { ElementRef } from '@reactcraft/shared';

import type { ErrorInfo } from '../../routes/error-text.ts';
import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { currentDesignFile } from './design-store.ts';
import { insertAnchor } from './design-target.ts';

export type SelectionAnchor =
  | { readonly ok: true; readonly anchor: ElementRef }
  | { readonly ok: false; readonly error: ErrorInfo };

/**
 * The element of the designed file to insert at for the selected `ref`. When there is none (the
 * selection is in a layout or a component outside the page), the error names the selection's file
 * and its component, so the hint can offer to open it (`design.selectInFile`).
 */
export function selectionAnchor(ref: ElementRef): SelectionAnchor {
  const { treeNodes, selectionInfo } = useSelectionStore.getState();
  const designFile = currentDesignFile();
  const ancestors = selectionInfo.find(
    (info) => info.ref.loc === ref.loc && info.ref.index === ref.index,
  )?.ancestors;
  const anchor = insertAnchor(ref, treeNodes, designFile, ancestors);
  if (anchor !== undefined) return { ok: true, anchor };

  const foreignFile = ref.loc.split(':')[0] ?? ref.loc;
  const component = useComponentsStore.getState().components.find((c) => c.file === foreignFile);
  return {
    ok: false,
    error: {
      code: 'design.selectInFile',
      params: {
        file: designFile ?? '',
        foreignFile,
        ...(component === undefined ? {} : { component: component.name }),
      },
    },
  };
}
