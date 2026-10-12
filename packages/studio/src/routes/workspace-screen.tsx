import type { SessionInfo } from '../api/session.ts';
import { EditorScreen } from './editor-screen.tsx';
import { WelcomeScreen } from './welcome-screen.tsx';
import { WorkspaceErrorScreen } from './workspace-error-screen.tsx';

type WorkspaceScreenProps = {
  readonly session: SessionInfo;
  /** Reads the session again: after a retry, or once a workspace was created. */
  readonly onRetry: () => void;
};

/** One screen per workspace state (SPEC-04.1 section 6.1). */
export function WorkspaceScreen({ session, onRetry }: WorkspaceScreenProps) {
  const { version, workspace } = session;
  switch (workspace.state) {
    case 'none':
      return (
        <WelcomeScreen
          version={version}
          onCreated={onRetry}
          {...(workspace.directory === undefined ? {} : { directory: workspace.directory })}
        />
      );
    case 'error':
      return (
        <WorkspaceErrorScreen
          version={version}
          problems={workspace.problems ?? []}
          onChanged={onRetry}
        />
      );
    case 'open':
      return <EditorScreen version={version} name={workspace.name} revision={workspace.revision} />;
  }
}
