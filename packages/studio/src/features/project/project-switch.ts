// Opening another project must not show anything of the one before (spec-log #115): the file tree,
// the selection, the undo list, the chat and the Canvas errors all belong to one project. The
// Editor is also remounted per project (routes/project-screen.tsx), so what panels load when they
// mount is read again; this module clears what lives outside React.
import { useCanvasErrorStore } from '../../core/canvas-error-store.ts';
import { useHistoryStore } from '../../core/history-store.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { useBuildCheckStore } from '../build-check/build-check-store.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useFilesStore } from '../files/files-store.ts';

/** Clears every store that holds data of the open project. */
export function resetProjectState(): void {
  useFilesStore.getState().reset();
  useSelectionStore.getState().reset();
  useHistoryStore.getState().reset();
  useChatStore.getState().reset();
  useCanvasErrorStore.getState().reset();
  useBuildCheckStore.getState().reset();
  useDesignStore.setState({ target: undefined, componentMode: undefined });
  useComponentsStore.getState().reset();
}

/**
 * Clears the project data when the open project changes to another one, or closes. Called once at
 * start; returns the function that stops watching.
 */
export function watchProjectSwitch(): () => void {
  return useProjectStore.subscribe((state, previous) => {
    const before = previous.project?.id;
    if (before !== undefined && state.project?.id !== before) {
      resetProjectState();
      if (state.project !== undefined) void useHistoryStore.getState().load();
    }
  });
}
