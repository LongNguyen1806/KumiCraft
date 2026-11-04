// "This page has no session yet" (spec-log #78): the page opens in the current session, and one
// click ties it to the session its role needs, or opens the list to add one.
import type { LoginSession } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { useSessionPickerStore } from './session-pages.ts';
import { sessionLabel } from './session-popover.tsx';

type SessionPageNoticeProps = {
  readonly sessions: readonly LoginSession[];
  readonly activeSessionId: number;
  readonly onPick: (id: number) => void;
};

export function SessionPageNotice({ sessions, activeSessionId, onPick }: SessionPageNoticeProps) {
  const { t } = useTranslation();
  const openPicker = useSessionPickerStore((st) => st.setOpen);
  const active = sessions.find((st) => st.id === activeSessionId) ?? sessions[0];
  return (
    <div
      role="status"
      data-testid="session-page-notice"
      className="flex flex-wrap items-center gap-2 border-b border-line bg-sun-soft/60 px-4 py-1.5 text-xs text-ink"
    >
      <span>
        {t('sessions.pageUnassigned', {
          label: active === undefined ? '' : sessionLabel(t, active),
        })}
      </span>
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          data-testid={`session-page-pick-${String(session.id)}`}
          onClick={() => {
            onPick(session.id);
          }}
          className="rounded border border-border bg-field px-2 py-0.5 hover:bg-field-hover"
        >
          {sessionLabel(t, session)}
        </button>
      ))}
      <button
        type="button"
        data-testid="session-page-add"
        onClick={() => {
          openPicker(true);
        }}
        className="rounded px-2 py-0.5 text-accent hover:underline"
      >
        {t('sessions.addForPage')}
      </button>
    </div>
  );
}
