// Maps ShortcutAction to store/command invocations (SPEC-04 R-KB-12).
import type { ShortcutAction } from '@reactcraft/shared';

import { openInEditor } from '../../api/editor-client.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { usePanelLayoutStore } from '../editor/use-panel-layout.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { siblingMoveTarget } from '../inspector/sibling-move.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import {
  executeDuplicate,
  executeMove,
  executeRemove,
  executeUnwrap,
  executeWrap,
} from '../structure/structure-commands.ts';
import { useShortcutHelpStore } from './shortcut-help-store.ts';

export function selectParentNode(): boolean {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) return false;
  const currentRef = selectedRefs[0];
  if (!currentRef) return false;

  const treeNodes = useSelectionStore.getState().treeNodes;
  const currentNode = treeNodes.find(
    (n) => n.ref.loc === currentRef.loc && n.ref.index === currentRef.index,
  );
  if (!currentNode || currentNode.parent === undefined) return false;

  const parentNode = treeNodes[currentNode.parent];
  if (!parentNode || !parentNode.ref.loc) return false;

  useSelectionStore.getState().setSelectedRefs([parentNode.ref]);
  return true;
}

function runStructureShortcut(action: ShortcutAction): boolean {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) return false;
  const ref = selectedRefs[0];
  if (!ref) return false;

  const treeNodes = useSelectionStore.getState().treeNodes;

  switch (action) {
    case 'duplicate':
      void executeDuplicate();
      return true;
    case 'remove':
      void executeRemove();
      return true;
    case 'wrap':
      void executeWrap('column');
      return true;
    case 'unwrap':
      void executeUnwrap();
      return true;
    case 'moveUp': {
      const target = siblingMoveTarget(treeNodes, ref, 'up');
      if (!target) return false;
      void executeMove('up');
      return true;
    }
    case 'moveDown': {
      const target = siblingMoveTarget(treeNodes, ref, 'down');
      if (!target) return false;
      void executeMove('down');
      return true;
    }
    default:
      return false;
  }
}

function runZoomOrFrame(action: ShortcutAction): boolean {
  const canvas = useCanvasViewStore.getState();
  switch (action) {
    case 'zoomIn':
      canvas.zoomIn();
      return true;
    case 'zoomOut':
      canvas.zoomOut();
      return true;
    case 'zoomReset':
      canvas.zoomReset();
      return true;
    case 'zoomFit':
      canvas.zoomFit();
      return true;
    case 'togglePreview':
      canvas.toggleMode();
      return true;
    default:
      if (action.startsWith('frame')) {
        const idx = parseInt(action.slice(5), 10) - 1;
        return canvas.selectFrameByIndex(idx);
      }
      return false;
  }
}

/**
 * Execute a shortcut action. Returns true if handled (and can prevent default),
 * false if the action could not be performed (e.g. no selection for duplicate).
 */
export function runShortcut(action: ShortcutAction): boolean {
  switch (action) {
    case 'undo': {
      const history = useHistoryStore.getState();
      if (!history.canUndo) return false;
      void history.undo();
      return true;
    }
    case 'redo': {
      const history = useHistoryStore.getState();
      if (!history.canRedo) return false;
      void history.redo();
      return true;
    }
    case 'selectParent':
      return selectParentNode();
    case 'togglePanels':
      usePanelLayoutStore.getState().toggleBoth();
      return true;
    case 'showShortcuts':
      useShortcutHelpStore.getState().toggle();
      return true;
    case 'openInEditor': {
      const selected = useSelectionStore.getState().selectedRefs;
      if (selected.length !== 1 || !selected[0]) return false;
      void openInEditor(selected[0].loc);
      return true;
    }
    default:
      if (runStructureShortcut(action)) return true;
      return runZoomOrFrame(action);
  }
}
