// Plan limits and last turn usage shown in the chat's model popover (K9.5).
import type { AgentLimit, AgentStatus } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import type { AgentUsageView } from './usage-store.ts';

function LimitBar({ label, limit }: { readonly label: string; readonly limit: AgentLimit }) {
  const { t, i18n } = useTranslation('chat');
  const pct = Math.round(limit.used * 100);
  const fill = limit.used > 0.95 ? 'bg-danger' : limit.used > 0.8 ? 'bg-sun' : 'bg-accent';
  const reset =
    limit.resetsAt === undefined
      ? undefined
      : new Date(limit.resetsAt).toLocaleString(i18n.language, {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink">{label}</span>
        <span className="text-ink-soft tabular-nums">{pct}%</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 overflow-hidden rounded-full bg-field"
      >
        <div className={`h-full ${fill}`} style={{ width: `${String(pct)}%` }} />
      </div>
      {reset !== undefined && (
        <span className="text-[10px] text-ink-faint">
          {t('agentSettings.resetsAt', { time: reset })}
        </span>
      )}
    </div>
  );
}

export function UsageSection({
  agentId,
  usage,
}: {
  readonly agentId: AgentStatus['id'];
  readonly usage: AgentUsageView | undefined;
}) {
  const { t, i18n } = useTranslation('chat');
  const hasLimits = usage?.fiveHour !== undefined || usage?.week !== undefined;
  return (
    <div data-testid="agent-settings-usage" className="flex flex-col gap-2">
      {usage?.fiveHour !== undefined && (
        <LimitBar label={t('agentSettings.fiveHour')} limit={usage.fiveHour} />
      )}
      {usage?.week !== undefined && <LimitBar label={t('agentSettings.week')} limit={usage.week} />}
      {!hasLimits && (
        <p className="text-[11px] text-ink-soft">
          {agentId === 'agy' ? t('agentSettings.noLimitsAgy') : t('agentSettings.noLimitsYet')}
        </p>
      )}
      {usage?.tokens !== undefined && (
        <p className="text-[11px] text-ink-soft tabular-nums">
          {t('agentSettings.lastTurn', { tokens: usage.tokens.toLocaleString(i18n.language) })}
          {usage.costUsd !== undefined && ` · $${usage.costUsd.toFixed(2)}`}
        </p>
      )}
      {usage !== undefined && (
        <p className="text-[10px] text-ink-faint">
          {t('agentSettings.updatedAt', {
            time: new Date(usage.updatedAt).toLocaleTimeString(i18n.language, {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </p>
      )}
    </div>
  );
}
