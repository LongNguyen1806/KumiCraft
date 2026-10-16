// Session of the Studio (SPEC-03 section 5.1): which screen to show follows its project state.
import { useCallback, useEffect, useState } from 'react';

import { fetchSession, type SessionInfo } from '../../api/session.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { useSettingsStore } from '../../store/settings-store.ts';

export type SessionState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly session: SessionInfo }
  | { readonly status: 'failed'; readonly info: ErrorInfo; readonly code: string };

/**
 * Loads `GET /session`. `reload` refreshes it in place: the current screen stays until the new
 * answer arrives, so a reconnect does not flash the loading screen.
 */
export function useSession(): { readonly state: SessionState; readonly reload: () => void } {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        // Settings come with the session, so the saved language shows from the first screen.
        const [session] = await Promise.all([fetchSession(), useSettingsStore.getState().load()]);
        if (isActive) setState({ status: 'ready', session });
      } catch (error) {
        if (isActive) {
          const info = toErrorInfo(error);
          setState({ status: 'failed', info, code: info.code });
        }
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return { state, reload };
}
