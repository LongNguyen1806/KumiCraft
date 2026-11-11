// Login assistance card with 3 steps, auto-polling state, and retry actions (R-AG-21).
import type { AgentId } from '@kumicraft/shared';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { errorText } from '../../routes/error-text.ts';
import { useAgentsStore } from '../../store/agents-store.ts';
import { agentDisplayName } from './agent-card.tsx';

function LoginStepsList() {
  const { t } = useTranslation('chat');
  return (
    <ol
      data-testid="agent-login-steps"
      className="list-decimal list-inside space-y-1 text-xs text-ink-soft bg-field/40 p-2.5 rounded-lg border border-border"
    >
      <li>{t('loginStep1')}</li>
      <li>{t('loginStep2')}</li>
      <li>
        <span className="font-semibold text-ink">{t('loginStep3Bold')}</span> {t('loginStep3Rest')}
      </li>
    </ol>
  );
}

function LoginFailureView() {
  const { t } = useTranslation('errors');
  const loginFlow = useAgentsStore((s) => s.loginFlow);
  const error = loginFlow?.error;
  if (error === undefined) return undefined;
  return (
    <div data-testid="agent-login-error" className="text-xs text-danger font-medium">
      {errorText(t, error.code, error.params)}
    </div>
  );
}

function LoginStatusView() {
  const { t } = useTranslation('chat');
  const loginFlow = useAgentsStore((s) => s.loginFlow);
  if (loginFlow === undefined) return undefined;

  if (loginFlow.phase === 'done') {
    return (
      <div data-testid="agent-login-done" className="text-xs text-leaf font-medium">
        {t('loginDoneNotice')}
      </div>
    );
  }

  if (loginFlow.phase === 'timedOut') {
    return (
      <div data-testid="agent-login-timeout" className="text-xs text-warn font-medium">
        {t('loginTimeoutNotice')}
      </div>
    );
  }

  if (loginFlow.phase === 'waiting' && !loginFlow.manual) {
    return (
      <div
        data-testid="agent-login-waiting"
        className="flex items-center gap-2 text-xs text-ink-soft"
      >
        <Loader2 className="size-3.5 animate-spin text-ink-soft" />
        <span>{t('loginWaitingNotice')}</span>
      </div>
    );
  }

  return undefined;
}

function ManualDoneButton({ onDone }: { readonly onDone: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <button
      type="button"
      data-testid="agent-login-manual-done"
      onClick={onDone}
      className="rounded-md bg-charcoal px-3 h-6 text-xs font-medium text-on-charcoal hover:bg-primary-hover"
    >
      {t('loginManualDone')}
    </button>
  );
}

function TimeoutRecheckButton({ onRecheck }: { readonly onRecheck: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <button
      type="button"
      data-testid="agent-login-recheck"
      onClick={onRecheck}
      className="rounded-md bg-field px-3 h-6 text-xs text-ink hover:bg-field-hover"
    >
      {t('recheck')}
    </button>
  );
}

async function executeManualDone(
  refresh: () => Promise<void>,
  setLoginPhase: (phase: 'done') => void,
): Promise<void> {
  await refresh();
  setLoginPhase('done');
}

async function executeRecheck(
  agent: AgentId,
  refresh: () => Promise<void>,
  setLoginPhase: (phase: 'done') => void,
): Promise<void> {
  await refresh();
  const agents = useAgentsStore.getState().agents;
  const target = agents?.find((a) => a.id === agent);
  if (target?.login === 'loggedIn') setLoginPhase('done');
}

function LoginCardActions() {
  const { t } = useTranslation('chat');
  const loginFlow = useAgentsStore((s) => s.loginFlow);
  const startLogin = useAgentsStore((s) => s.startLogin);
  const cancelLogin = useAgentsStore((s) => s.cancelLogin);
  const refresh = useAgentsStore((s) => s.refresh);
  const setLoginPhase = useAgentsStore((s) => s.setLoginPhase);

  if (loginFlow === undefined || loginFlow.phase === 'done') return undefined;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
      {loginFlow.manual && (
        <ManualDoneButton
          onDone={() => {
            void executeManualDone(refresh, setLoginPhase);
          }}
        />
      )}
      {loginFlow.phase === 'timedOut' && (
        <TimeoutRecheckButton
          onRecheck={() => {
            void executeRecheck(loginFlow.agent, refresh, setLoginPhase);
          }}
        />
      )}
      <button
        type="button"
        data-testid="agent-login-reopen"
        onClick={() => {
          void startLogin(loginFlow.agent, loginFlow.resend);
        }}
        className="rounded-md bg-field px-3 h-6 text-xs text-ink hover:bg-field-hover"
      >
        {t('loginReopen')}
      </button>
      <button
        type="button"
        data-testid="agent-login-cancel"
        onClick={cancelLogin}
        className="rounded-md bg-field px-3 h-6 text-xs text-ink hover:bg-field-hover"
      >
        {t('cancel')}
      </button>
    </div>
  );
}

export function AgentLoginCard() {
  const { t } = useTranslation('chat');
  const loginFlow = useAgentsStore((s) => s.loginFlow);

  if (loginFlow === undefined) return undefined;

  const agentName = agentDisplayName(loginFlow.agent);

  return (
    <div
      data-testid="agent-login-card"
      className="flex flex-col gap-3 rounded-lg border border-sun bg-sun-soft p-3.5 text-ink shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-ink">
          {t('loginCardTitle', { name: agentName })}
        </h4>
      </div>
      <LoginStepsList />
      <LoginFailureView />
      <LoginStatusView />
      <LoginCardActions />
    </div>
  );
}
