import type { SessionInfo } from '../api/session.ts';
import { EditorScreen } from './editor-screen.tsx';
import { NoProjectScreen } from './no-project-screen.tsx';
import { ProjectErrorScreen } from './project-error-screen.tsx';

type ProjectScreenProps = {
  readonly session: SessionInfo;
  /** Reads the session again, for example once the project is trusted. */
  readonly onRetry: () => void;
};

/** One screen per project state (SPEC-03 section 5.1). */
export function ProjectScreen({ session, onRetry }: ProjectScreenProps) {
  const { version, project } = session;
  switch (project.state) {
    case 'none':
      return (
        <NoProjectScreen
          version={version}
          {...(project.suggestedPath === undefined ? {} : { suggestedPath: project.suggestedPath })}
          onProjectOpened={onRetry}
        />
      );
    case 'error':
      return <ProjectErrorScreen version={version} error={project.error} />;
    case 'open':
      return (
        <EditorScreen
          projectId={project.id}
          projectName={project.name}
          trusted={project.trusted}
          onTrusted={onRetry}
        />
      );
  }
}
