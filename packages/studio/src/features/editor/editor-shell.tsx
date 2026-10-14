import { TrustPrompt } from '../trust/trust-prompt.tsx';
import { CanvasArea } from './canvas-area.tsx';
import { EditorToolbar } from './editor-toolbar.tsx';
import { Resizer } from './resizer.tsx';
import { LeftPanel, RightPanel } from './side-panels.tsx';
import { StatusBar } from './status-bar.tsx';
import { useEditorShortcuts } from './use-editor-shortcuts.ts';
import { type PanelLayout, type Side, usePanelLayout } from './use-panel-layout.ts';

const columns = ({ width, visible }: PanelLayout): string =>
  `${visible.left ? `${String(width.left)}px 10px` : '0 0'} minmax(0,1fr) ${
    visible.right ? `10px ${String(width.right)}px` : '0 0'
  }`;

const SideHandle = ({
  side,
  layout,
  resize,
}: {
  readonly side: Side;
  readonly layout: PanelLayout;
  readonly resize: (side: Side, width: number) => void;
}) => (
  <Resizer
    side={side}
    width={layout.width[side]}
    hidden={!layout.visible[side]}
    onResize={(width) => {
      resize(side, width);
    }}
  />
);

/** Left panel, Canvas and right panel, with the resize handles between them. */
function WorkGrid({ panels }: { readonly panels: ReturnType<typeof usePanelLayout> }) {
  const { layout, resize } = panels;
  return (
    <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: columns(layout) }}>
      {layout.visible.left ? <LeftPanel /> : <div />}
      <SideHandle side="left" layout={layout} resize={resize} />
      <CanvasArea />
      <SideHandle side="right" layout={layout} resize={resize} />
      {layout.visible.right ? <RightPanel /> : <div />}
    </div>
  );
}

type EditorShellProps = {
  readonly projectId: string;
  readonly projectName: string;
  /** S-81: an untrusted project opens in restricted mode. */
  readonly trusted: boolean;
  readonly onTrusted: () => void;
};

/** The Editor of an open project: toolbar, panels, Canvas and status bar. */
export function EditorShell({ projectId, projectName, trusted, onTrusted }: EditorShellProps) {
  const panels = usePanelLayout();
  useEditorShortcuts({ togglePanels: panels.toggleBoth });
  return (
    <div className="flex h-full flex-col gap-2.5 px-3.5 py-3">
      <EditorToolbar
        projectName={projectName}
        visible={panels.layout.visible}
        onToggle={panels.toggle}
      />
      {!trusted && (
        <TrustPrompt projectId={projectId} projectName={projectName} onTrusted={onTrusted} />
      )}
      <WorkGrid panels={panels} />
      <StatusBar trusted={trusted} />
    </div>
  );
}
