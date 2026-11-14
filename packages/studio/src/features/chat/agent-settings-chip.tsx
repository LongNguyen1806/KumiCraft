// The model chip by Send: `✦ Sonnet · Cao ▾`, an eye in Ask mode, the border warns as the plan
// limits run out, and a glow around "Default" until a message is sent (K9.5; owner, 2026-11-15).
import type { AgentModelOption, AgentRunChoice } from '@kumicraft/shared';
import { ChevronDown, Eye, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function ringClass(used: number | undefined): string {
  if (used !== undefined && used > 0.95) return 'border-danger';
  if (used !== undefined && used > 0.8) return 'border-sun';
  return 'border-border';
}

const GLOW_CLASS =
  'border-accent text-accent shadow-[0_0_0_3px_var(--color-accent-soft),0_0_12px_var(--color-accent)] motion-safe:animate-pulse';

type SettingsChipProps = {
  readonly open: boolean;
  readonly allowEdits: boolean;
  readonly choice: AgentRunChoice | undefined;
  readonly models: readonly AgentModelOption[] | undefined;
  readonly used: number | undefined;
  /** Glows while on "Default" until a message is sent this visit (owner, 2026-11-15). */
  readonly glow: boolean;
  readonly onToggle: () => void;
};

function chipTitleKey(glow: boolean, allowEdits: boolean) {
  if (glow) return 'agentSettings.pickModelHint';
  return allowEdits ? 'agentSettings.title' : 'readOnlyNotice';
}

export function SettingsChip({
  open,
  allowEdits,
  choice,
  models,
  used,
  glow: wantsGlow,
  onToggle,
}: SettingsChipProps) {
  const { t } = useTranslation('chat');
  const ring = ringClass(used);
  // A limit warning matters more than the reminder to pick a model.
  const glow = wantsGlow && ring === 'border-border';
  const modelLabel =
    models?.find((m) => m.id === choice?.model)?.label ??
    choice?.model ??
    t('agentSettings.default');
  const effortLabel =
    choice?.effort === undefined ? undefined : t(`agentSettings.efforts.${choice.effort}`);
  return (
    <button
      type="button"
      data-testid="agent-settings-chip"
      aria-haspopup="dialog"
      aria-expanded={open}
      data-glow={glow ? 'true' : undefined}
      title={t(chipTitleKey(glow, allowEdits))}
      onClick={onToggle}
      className={`flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-ink-soft hover:text-ink cursor-pointer ${glow ? GLOW_CLASS : ring}`}
    >
      <Sparkles className="size-3 shrink-0" />
      <span className="truncate">
        {modelLabel}
        {effortLabel !== undefined && ` · ${effortLabel}`}
      </span>
      {!allowEdits && (
        <Eye
          data-testid="agent-settings-ask"
          aria-label={t('agentSettings.ask')}
          className="size-3 shrink-0"
        />
      )}
      <ChevronDown className="size-3 shrink-0" />
    </button>
  );
}
