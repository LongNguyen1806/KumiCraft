import type { ProjectInfo } from '@kumicraft/shared';
import { useEffect, useState } from 'react';

import { fetchProject } from '../../api/project-client.ts';
import { useDesignTargetSync } from '../design/design-store.ts';
import { useHistorySync } from '../history/history-store.ts';
import { InstallDialog } from '../project/install-dialog.tsx';
import { ProjectDialog } from '../project/project-dialog.tsx';
import { useProjectStore } from '../project/project-store.ts';
import { ActivityBar } from '../shell/activity-bar.tsx';
import { ShortcutHelp } from '../shortcuts/shortcut-help.tsx';
import { useShortcuts } from '../shortcuts/use-shortcuts.ts';
import { TrustPrompt } from '../trust/trust-prompt.tsx';
import { CanvasArea } from './canvas-area.tsx';
import { EditorToolbar } from './editor-toolbar.tsx';
import { Resizer } from './resizer.tsx';
import { LeftPanel, RightPanel } from './side-panels.tsx';
import { StatusBar } from './status-bar.tsx';
import { type PanelLayout, type Side, usePanelLayout } from './use-panel-layout.ts';

const columns = ({ width, visible }: PanelLayout): string =>
  `44px ${visible.left ? `${String(width.left)}px 5px` : '0 0'} minmax(0,1fr) ${
    visible.right ? `5px ${String(width.right)}px` : '0 0'
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
function WorkGrid({
  panels,
  projectInfo,
  trusted,
  onTrustRequest,
  onInstallRequest,
}: {
  readonly panels: ReturnType<typeof usePanelLayout>;
  readonly projectInfo?: ProjectInfo | undefined;
  readonly trusted: boolean;
  readonly onTrustRequest?: (() => void) | undefined;
  readonly onInstallRequest?: (() => void) | undefined;
}) {
  const { layout, resize } = panels;
  return (
    <div
      className="grid min-h-0 flex-1 bg-card-solid"
      style={{ gridTemplateColumns: columns(layout) }}
    >
      <ActivityBar />
      {layout.visible.left ? <LeftPanel /> : <div />}
      <SideHandle side="left" layout={layout} resize={resize} />
      <CanvasArea
        projectInfo={projectInfo}
        trusted={trusted}
        onTrustRequest={onTrustRequest}
        onInstallRequest={onInstallRequest}
      />
      <SideHandle side="right" layout={layout} resize={resize} />
      {layout.visible.right ? <RightPanel trusted={trusted} /> : <div />}
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

function useProjectLoader(trusted: boolean) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>();
  const [installDialogOpen, setInstallDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const info = await fetchProject();
        if (active) {
          setProjectInfo(info);
          if (info.needsInstall && trusted) {
            setInstallDialogOpen(true);
          }
        }
      } catch {
        // Project might not be open yet or error, ignore
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [trusted]);

  useEffect(() => {
    useProjectStore.getState().setProject(projectInfo);
  }, [projectInfo]);

  const refreshProject = async () => {
    try {
      const refreshed = await fetchProject();
      setProjectInfo(refreshed);
    } catch {
      // ignore
    }
  };

  return {
    projectInfo,
    setProjectInfo,
    projectDialogOpen,
    setProjectDialogOpen,
    installDialogOpen,
    setInstallDialogOpen,
    refreshProject,
  };
}

function EditorDialogs({
  loader,
  onTrusted,
}: {
  readonly loader: ReturnType<typeof useProjectLoader>;
  readonly onTrusted: () => void;
}) {
  return (
    <>
      <ProjectDialog
        open={loader.projectDialogOpen}
        initialPath={loader.projectInfo?.root}
        currentProject={loader.projectInfo}
        onClose={() => {
          loader.setProjectDialogOpen(false);
        }}
        onProjectOpened={(info) => {
          loader.setProjectInfo(info);
          loader.setProjectDialogOpen(false);
          onTrusted();
        }}
      />
      {loader.projectInfo?.needsInstall && (
        <InstallDialog
          open={loader.installDialogOpen}
          installCommand={loader.projectInfo.installCommand}
          onClose={() => {
            loader.setInstallDialogOpen(false);
          }}
          onInstalled={() => {
            loader.setInstallDialogOpen(false);
            void loader.refreshProject();
          }}
        />
      )}
    </>
  );
}

/** The Editor of an open project: toolbar, panels, Canvas and status bar. */
export function EditorShell({ projectId, projectName, trusted, onTrusted }: EditorShellProps) {
  const panels = usePanelLayout();
  useHistorySync(true);
  useShortcuts();
  useDesignTargetSync();
  const loader = useProjectLoader(trusted);

  return (
    <div className="flex h-full flex-col bg-card-solid">
      <EditorToolbar
        projectName={projectName}
        visible={panels.layout.visible}
        onToggle={panels.toggle}
        onOpenProject={() => {
          loader.setProjectDialogOpen(true);
        }}
      />
      {!trusted && (
        <TrustPrompt
          projectId={projectId}
          projectName={projectName}
          projectRoot={loader.projectInfo?.root}
          backends={loader.projectInfo?.backends}
          onTrusted={onTrusted}
        />
      )}
      <WorkGrid
        panels={panels}
        projectInfo={loader.projectInfo}
        trusted={trusted}
        onTrustRequest={onTrusted}
        onInstallRequest={() => {
          loader.setInstallDialogOpen(true);
        }}
      />
      <StatusBar trusted={trusted} />
      <EditorDialogs loader={loader} onTrusted={onTrusted} />
      <ShortcutHelp />
    </div>
  );
}
