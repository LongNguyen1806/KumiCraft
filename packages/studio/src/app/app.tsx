import { ConnectionOverlay } from '../features/shell/connection-overlay.tsx';
import { useConnection } from '../features/shell/use-connection.ts';
import { useSession } from '../features/shell/use-session.ts';
import { LoadingScreen } from '../routes/loading-screen.tsx';
import { SessionErrorScreen } from '../routes/session-error-screen.tsx';
import { WorkspaceScreen } from '../routes/workspace-screen.tsx';

/** Studio shell: session first, then the screen of the workspace state (SPEC-04.1 section 6.1). */
export function App() {
  const { state, reload } = useSession();
  const connection = useConnection(state.status === 'ready', reload);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'failed') return <SessionErrorScreen code={state.code} />;

  const isOffline = connection === 'offline';
  return (
    <>
      <div className="h-full" inert={isOffline}>
        <WorkspaceScreen session={state.session} onRetry={reload} />
      </div>
      {isOffline && <ConnectionOverlay />}
    </>
  );
}
