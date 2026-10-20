import { ConnectionOverlay } from '../features/shell/connection-overlay.tsx';
import { useConnection } from '../features/shell/use-connection.ts';
import { useSession } from '../features/shell/use-session.ts';
import { LoadingScreen } from '../routes/loading-screen.tsx';
import { ProjectScreen } from '../routes/project-screen.tsx';
import { SessionErrorScreen } from '../routes/session-error-screen.tsx';

/** Studio shell: session first, then the screen of the project state (SPEC-03 section 5.1). */
export function App() {
  const { state, reload } = useSession();
  const connection = useConnection(state.status === 'ready', reload);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'failed') {
    return <SessionErrorScreen code={state.code} errorInfo={state.info} />;
  }

  const isOffline = connection === 'offline' || connection === 'stopped';
  return (
    <>
      <div className="h-full" inert={isOffline}>
        <ProjectScreen session={state.session} onRetry={reload} />
      </div>
      {isOffline && <ConnectionOverlay stopped={connection === 'stopped'} />}
    </>
  );
}
