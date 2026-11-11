// Opening another project must not show anything of the one before (spec-log #115): the file tree,
// the selection, the undo list, the chat and the Canvas errors all belong to one project. The
// Editor is also remounted per project (routes/project-screen.tsx), so what panels load when they
// mount is read again; this module clears what lives outside React.
import { useBuildCheckStore } from '../build-check/build-check-store.ts';
import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useFilesStore } from '../files/files-store.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useProjectStore } from './project-store.ts';

/** Clears every store that holds data of the open project. */
export function resetProjectState(): void {
  useFilesStore.getState().reset();
  useSelectionStore.getState().reset();
  useHistoryStore.getState().reset();
  useChatStore.getState().reset();
  useCanvasErrorStore.getState().reset();
  useBuildCheckStore.getState().reset();
  useDesignStore.setState({ target: undefined, componentMode: undefined });
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
