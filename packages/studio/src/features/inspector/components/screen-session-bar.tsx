// "Edit for Mobile only" (spec-log #144). On the widest frame (where the page is designed) nothing
// shows: every edit reaches all screens. On a narrower frame a line says so and offers a button that
// starts an edit for that screen only; while it runs an accent bar shows Done and Cancel.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchHistoryState, undoHistory } from '../../../api/history-client.ts';
import { useHistoryStore } from '../../history/history-store.ts';
import { isDesignFrame, useInSession, useScreenEditStore, useScreens } from '../screen-scope.ts';
import { ScreenIcon } from './screen-scope-controls.tsx';

/** Undoes every edit made since the session started, then ends it. */
async function cancelSession(undoAtStart: number): Promise<void> {
  const now = await fetchHistoryState();
  let state = now;
  for (let i = now.undoCount; i > undoAtStart; i -= 1) {
    state = await undoHistory();
  }
  useHistoryStore.getState().applyState(state);
}

function SessionBar({ frame }: { readonly frame: string }) {
  const { t } = useTranslation();
  const session = useScreenEditStore((s) => s.session);
  const setSession = useScreenEditStore((s) => s.setSession);
  const [busy, setBusy] = useState(false);
  return (
    <div
      data-testid="screen-session-bar"
      className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs text-card-solid"
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-card-solid" />
      <span className="min-w-0 flex-1 truncate font-medium">
        {t('inspector.screen.editing', { frame })}
      </span>
      <button
        type="button"
        data-testid="screen-session-done"
        disabled={busy}
        onClick={() => {
          setSession(undefined);
        }}
        className="h-6 rounded bg-card-solid px-2 font-semibold text-accent hover:opacity-90 disabled:opacity-50"
      >
        {t('inspector.screen.done')}
      </button>
      <button
        type="button"
        data-testid="screen-session-cancel"
        disabled={busy}
        onClick={() => {
          if (session === undefined) return;
          setBusy(true);
          void cancelSession(session.undoAtStart).finally(() => {
            setBusy(false);
            setSession(undefined);
          });
        }}
        className="h-6 rounded px-2 font-medium text-card-solid hover:bg-card-solid/15 disabled:opacity-50"
      >
        {t('inspector.screen.cancel')}
      </button>
    </div>
  );
}

/** The screen line of the Inspector header for element `loc`. */
export function ScreenSessionBar({
  loc,
  stateActive,
}: {
  readonly loc: string;
  readonly stateActive: boolean;
}) {
  const { t } = useTranslation();
  const screens = useScreens();
  const running = useInSession(loc);
  const setSession = useScreenEditStore((s) => s.setSession);
  const active = screens.active;
  if (active === undefined || screens.frames.length < 2 || isDesignFrame(screens)) return undefined;
  if (running) return <SessionBar frame={active.label} />;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
      <ScreenIcon width={active.width} className="size-3.5 shrink-0 text-ink-faint" />
      <span className="min-w-0 flex-1 leading-snug">
        {t('inspector.screen.viewing', { frame: active.label })}
      </span>
      <button
        type="button"
        data-testid="screen-session-start"
        disabled={stateActive}
        title={stateActive ? t('inspector.screen.stateHint') : undefined}
        onClick={() => {
          setSession({
            loc,
            frameId: active.id,
            undoAtStart: useHistoryStore.getState().undoCount,
          });
        }}
        className="h-6 shrink-0 rounded-md border border-accent px-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('inspector.screen.start', { frame: active.label })}
      </button>
    </div>
  );
}
