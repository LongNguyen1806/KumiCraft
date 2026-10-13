import { type DesignDocument, type DesignNode, type Frame, walkTree } from '@reactcraft/model';
import { useEffect, useState } from 'react';

import { type EditorState, useEditorStore } from '../../store/editor-store.ts';
import { TrustPrompt } from '../trust/trust-prompt.tsx';
import { CanvasArea, fitScale } from './canvas-area.tsx';
import { EditorToolbar } from './editor-toolbar.tsx';
import { Resizer } from './resizer.tsx';
import { LeftPanel, RightPanel } from './side-panels.tsx';
import { StatusBar } from './status-bar.tsx';
import { useEditorShortcuts } from './use-editor-shortcuts.ts';
import { type PanelLayout, type Side, usePanelLayout } from './use-panel-layout.ts';

/** From the root to the node `id`, or empty when it is not in the tree. */
export function pathTo(root: DesignNode | undefined, id: string | undefined): DesignNode[] {
  if (root === undefined || id === undefined) return [];
  const parents = new Map<DesignNode, DesignNode | undefined>();
  let found: DesignNode | undefined;
  walkTree(root, (node, { parent }) => {
    parents.set(node, parent);
    if (node.id === id) found = node;
  });
  const path: DesignNode[] = [];
  for (let node = found; node !== undefined; node = parents.get(node)) path.unshift(node);
  return path;
}

const columns = ({ width, visible }: PanelLayout): string =>
  `${visible.left ? `${String(width.left)}px 10px` : '0 0'} minmax(0,1fr) ${
    visible.right ? `10px ${String(width.right)}px` : '0 0'
  }`;

/** R-HS-03: the browser asks before closing a tab whose edits the server does not have yet. */
function useUnsavedGuard(hasUnsaved: () => boolean): void {
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsaved()) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasUnsaved]);
}

type WorkAreaProps = {
  readonly panels: ReturnType<typeof usePanelLayout>;
  readonly root: DesignNode | undefined;
  readonly path: readonly DesignNode[];
  readonly frame: Frame;
  readonly scale: number;
  readonly onCanvasWidth: (width: number) => void;
};

/** Left panel, Canvas and right panel, with the resize handles between them. */
function WorkArea({ panels, root, path, frame, scale, onCanvasWidth }: WorkAreaProps) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const hoveredNodeId = useEditorStore((state) => state.hoveredNodeId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const toggleNodeSelection = useEditorStore((state) => state.toggleNodeSelection);
  const hoverNode = useEditorStore((state) => state.hoverNode);
  const { layout, resize } = panels;
  const handle = (side: Side) => (
    <Resizer
      side={side}
      width={layout.width[side]}
      hidden={!layout.visible[side]}
      onResize={(width) => {
        resize(side, width);
      }}
    />
  );
  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: columns(layout) }}>
      {layout.visible.left ? (
        <LeftPanel
          root={root}
          selectedNodeId={selectedNodeId}
          selectedNodeIds={selectedNodeIds}
          hoveredNodeId={hoveredNodeId}
          onSelect={selectNode}
          onToggleSelect={toggleNodeSelection}
          onHover={hoverNode}
        />
      ) : (
        <div />
      )}
      {handle('left')}
      <CanvasArea frame={frame} scale={scale} onWidth={onCanvasWidth} />
      {handle('right')}
      {layout.visible.right ? <RightPanel selected={path.at(-1)} /> : <div />}
    </div>
  );
}

/** Shortcuts of the frame and the guard against closing with unsaved edits. */
function useShellKeys(
  store: Pick<EditorState, 'undo' | 'redo' | 'hasUnsavedChanges'>,
  panels: ReturnType<typeof usePanelLayout>,
): void {
  useUnsavedGuard(store.hasUnsavedChanges);
  useEditorShortcuts({
    undo: store.undo,
    redo: store.redo,
    togglePanels: panels.toggleBoth,
  });
}

/** The Editor of an open workspace (SPEC-04.1 section 6.2), on the loaded document. */
type EditorShellProps = {
  readonly document: DesignDocument;
  /** S-81: an untrusted workspace opens in restricted mode. */
  readonly trusted: boolean;
  readonly onTrusted: () => void;
};

function EditorMain({
  document,
  store,
  panels,
  frame,
  scale,
  setCanvasWidth,
}: {
  readonly document: DesignDocument;
  readonly store: EditorState;
  readonly panels: ReturnType<typeof usePanelLayout>;
  readonly frame: Frame;
  readonly scale: number;
  readonly setCanvasWidth: (w: number) => void;
}) {
  const pageId = store.activePageId;
  const root = pageId === undefined ? undefined : document.pages[pageId]?.root;
  const path = pathTo(root, store.selectedNodeId);
  return (
    <>
      <WorkArea
        panels={panels}
        root={root}
        path={path}
        frame={frame}
        scale={scale}
        onCanvasWidth={setCanvasWidth}
      />
      <StatusBar
        status={store.syncStatus}
        notice={store.notice}
        revision={store.revision}
        path={path}
        selectedCount={store.selectedNodeIds.length}
        workspace={document.workspace}
      />
    </>
  );
}

export function EditorShell({ document, trusted, onTrusted }: EditorShellProps) {
  const store = useEditorStore();
  const panels = usePanelLayout();
  const { workspace } = document;
  const [frameId, setFrameId] = useState(workspace.primaryFrameId);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const frame = workspace.frames.find((item) => item.id === frameId) ?? workspace.frames[0];
  useShellKeys(store, panels);
  if (frame === undefined) return undefined;
  const scale = fitScale(canvasWidth, frame.width);
  return (
    <div className="flex h-full flex-col gap-2.5 px-3.5 py-3">
      <EditorToolbar
        workspaceName={workspace.name}
        pages={workspace.pageOrder.map((id) => ({ id, name: document.pages[id]?.name ?? id }))}
        activePageId={store.activePageId}
        onPage={store.setActivePageId}
        frames={workspace.frames}
        activeFrameId={frame.id}
        onFrame={setFrameId}
        zoomPercent={Math.round(scale * 100)}
        canUndo={store.undoStack.length > 0}
        canRedo={store.redoStack.length > 0}
        onUndo={store.undo}
        onRedo={store.redo}
        visible={panels.layout.visible}
        onToggle={panels.toggle}
      />
      {!trusted && <TrustPrompt workspace={workspace} onTrusted={onTrusted} />}
      <EditorMain
        document={document}
        store={store}
        panels={panels}
        frame={frame}
        scale={scale}
        setCanvasWidth={setCanvasWidth}
      />
    </div>
  );
}
