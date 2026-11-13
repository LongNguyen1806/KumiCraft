// Maps ShortcutAction to store/command invocations (SPEC-04 R-KB-12).
import type { ShortcutAction } from '@kumicraft/shared';

import { openInEditor } from '../../api/editor-client.ts';
import { copySelection, cutSelection, pasteClipboard } from '../clipboard/clipboard-actions.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { exitFrameFocus, stepFrame, toggleFrameFocus } from '../editor/frame-focus-store.ts';
import { usePanelLayoutStore } from '../editor/use-panel-layout.ts';
import { nudgeDelta, nudgeSelection } from '../free-frame/free-nudge.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { siblingMoveTarget } from '../inspector/sibling-move.ts';
import { useLayerMenuStore } from '../layer-menu/layer-menu-store.ts';
import { useProjectStore } from '../project/project-store.ts';
import { isStyleEditable } from '../project/use-style-edit.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
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
  if (useLayerMenuStore.getState().menu !== undefined) {
    useLayerMenuStore.getState().close();
    studioBridgeChannel.highlight(undefined);
    useSelectionStore.getState().setHoveredRef(undefined);
    return true;
  }
  if (useCanvasViewStore.getState().tool !== 'select') {
    useCanvasViewStore.getState().setTool('select');
    return true;
  }
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) {
    if (useDesignStore.getState().componentMode !== undefined) {
      useDesignStore.getState().exitComponentMode();
      return true;
    }
    return false;
  }
  const currentRef = selectedRefs[0];
  if (!currentRef) return false;

  const treeNodes = useSelectionStore.getState().treeNodes;
  const currentNode = treeNodes.find(
    (n) => n.ref.loc === currentRef.loc && n.ref.index === currentRef.index,
  );
  if (!currentNode || currentNode.parent === undefined) {
    if (useDesignStore.getState().componentMode !== undefined) {
      useDesignStore.getState().exitComponentMode();
      return true;
    }
    return false;
  }

  const parentNode = treeNodes[currentNode.parent];
  if (!parentNode || !parentNode.ref.loc) {
    if (useDesignStore.getState().componentMode !== undefined) {
      useDesignStore.getState().exitComponentMode();
      return true;
    }
    return false;
  }

  useSelectionStore.getState().setSelectedRefs([parentNode.ref]);
  // The Canvas must select it too, like the path buttons do: without it the Bridge kept the child,
  // so size handles and free moves still acted on the child (spec-log #129).
  studioBridgeChannel.select([parentNode.ref], true);
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

function runNudgeShortcut(action: ShortcutAction): boolean {
  if (!action.startsWith('nudge')) return false;
  const grid = useCanvasViewStore.getState().grid;
  const delta = nudgeDelta(action, grid);
  if (!delta) return false;
  void nudgeSelection(delta.dx, delta.dy);
  return true;
}

function runDrawToolShortcut(action: ShortcutAction): boolean {
  const canvas = useCanvasViewStore.getState();
  if (canvas.mode !== 'design') return false;
  const project = useProjectStore.getState().project;
  const editable = isStyleEditable(project);
  // Moving the view changes no file, so it works in every project.
  if (!editable && action !== 'toolSelect' && action !== 'toolPan') return false;
  switch (action) {
    case 'toolSelect':
      canvas.setTool('select');
      return true;
    case 'toolFrame':
      canvas.setTool('frame');
      return true;
    case 'toolText':
      canvas.setTool('text');
      return true;
    case 'toolImage':
      canvas.setTool('image');
      return true;
    case 'toolPan':
      canvas.setPanning(true);
      return true;
    default:
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
      // Nothing left to step out of: Esc leaves "one frame at a time".
      return selectParentNode() || exitFrameFocus();
    case 'toggleFrameFocus':
      return toggleFrameFocus();
    case 'frameNext':
      return stepFrame(1);
    case 'framePrev':
      return stepFrame(-1);
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
    case 'copy':
      void copySelection();
      return true;
    case 'cut':
      void cutSelection();
      return true;
    case 'paste':
      void pasteClipboard();
      return true;
    default:
      if (runDrawToolShortcut(action)) return true;
      if (runStructureShortcut(action)) return true;
      if (runNudgeShortcut(action)) return true;
      return runZoomOrFrame(action);
  }
}
