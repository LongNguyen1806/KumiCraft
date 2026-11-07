// One chip by Send: model · effort, with a popover for model, effort, edit/ask and plan limits (K9.5).
import {
  AGENT_EFFORTS,
  type AgentEffort,
  type AgentModelOption,
  type AgentRunChoice,
  type AgentStatus,
  normalizeWorkspaceAi,
} from '@kumicraft/shared';
import { ChevronDown, Eye, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchAgentModels } from '../../api/agent-client.ts';
import { patchProject } from '../../api/project-client.ts';
import { AgentBadge } from '../agents/agent-badge.tsx';
import { useProjectStore } from '../project/project-store.ts';
import { UsageSection } from './agent-usage.tsx';
import { type AgentUsageView, highestUse, useUsageStore } from './usage-store.ts';

type AiPatch = {
  readonly allowEdits?: boolean;
  readonly choice?: AgentRunChoice;
};

/** Saves the project's `ai` whole, so changing one part keeps the others. */
async function saveAi(agentId: AgentStatus['id'], patch: AiPatch): Promise<void> {
  const store = useProjectStore.getState();
  const project = store.project;
  if (project === undefined) return;
  const current = normalizeWorkspaceAi(project.ai);
  const agents =
    patch.choice === undefined ? current.agents : { ...current.agents, [agentId]: patch.choice };
  const ai = {
    allowEdits: patch.allowEdits ?? current.allowEdits,
    ...(agents === undefined ? {} : { agents }),
  };
  const info = await patchProject({ ai });
  store.setProject({ ...info, ai: info.ai ?? ai });
}

function useModels(agentId: AgentStatus['id'], open: boolean) {
  const [models, setModels] = useState<Partial<Record<string, readonly AgentModelOption[]>>>({});
  useEffect(() => {
    if (!open || models[agentId] !== undefined) return;
    let alive = true;
    const load = async () => {
      let list: readonly AgentModelOption[] = [];
      try {
        list = await fetchAgentModels(agentId);
      } catch {
        // No list: the select offers the agent's default only.
      }
      if (alive) setModels((m) => ({ ...m, [agentId]: list }));
    };
    void load();
    return () => {
      alive = false;
    };
  }, [agentId, open, models]);
  return models[agentId];
}

function ringClass(used: number | undefined): string {
  if (used !== undefined && used > 0.95) return 'border-rose-500';
  if (used !== undefined && used > 0.8) return 'border-sun';
  return 'border-border';
}

type ChoiceProps = {
  readonly agentId: AgentStatus['id'];
  readonly choice: AgentRunChoice | undefined;
  readonly models: readonly AgentModelOption[] | undefined;
  readonly busy: boolean;
  readonly onChange: (choice: AgentRunChoice) => void;
};

function ModelAndEffort({ choice, models, busy, onChange }: ChoiceProps) {
  const { t } = useTranslation('chat');
  const effort = choice?.effort;
  const pick = (next: { model?: string | undefined; effort?: AgentEffort | undefined }) => {
    const model = 'model' in next ? next.model : choice?.model;
    const eff = 'effort' in next ? next.effort : choice?.effort;
    onChange({
      ...(model === undefined ? {} : { model }),
      ...(eff === undefined ? {} : { effort: eff }),
    });
  };
  return (
    <>
      <label className="flex flex-col gap-1 text-[11px] text-ink-soft">
        {t('agentSettings.model')}
        <select
          data-testid="agent-settings-model"
          disabled={busy}
          value={choice?.model ?? ''}
          onChange={(e) => {
            pick({ model: e.target.value === '' ? undefined : e.target.value });
          }}
          className="rounded-md border border-border bg-field px-2 py-1 text-xs text-ink"
        >
          <option value="">{t('agentSettings.default')}</option>
          {(models ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <EffortPicker
        effort={effort}
        busy={busy}
        onPick={(e) => {
          pick({ effort: e });
        }}
      />
    </>
  );
}

function EffortPicker({
  effort,
  busy,
  onPick,
}: {
  readonly effort: AgentEffort | undefined;
  readonly busy: boolean;
  readonly onPick: (effort: AgentEffort | undefined) => void;
}) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex flex-col gap-1 text-[11px] text-ink-soft">
      <span id="agent-settings-effort-label">{t('agentSettings.effort')}</span>
      <div
        role="radiogroup"
        aria-labelledby="agent-settings-effort-label"
        className="grid grid-cols-5 gap-0.5 rounded-md bg-field p-0.5"
      >
        {AGENT_EFFORTS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={effort === e}
            data-testid={`agent-settings-effort-${e}`}
            disabled={busy}
            onClick={() => {
              onPick(effort === e ? undefined : e);
            }}
            className={`rounded px-1 py-1 text-[10px] cursor-pointer truncate ${
              effort === e ? 'bg-card-solid text-ink shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t(`agentSettings.efforts.${e}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditModeSwitch({
  allowEdits,
  busy,
  onChange,
}: {
  readonly allowEdits: boolean;
  readonly busy: boolean;
  readonly onChange: (allowEdits: boolean) => void;
}) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex flex-col gap-1 text-[11px] text-ink-soft">
      <span>{t('agentSettings.mode')}</span>
      <div className="grid grid-cols-2 gap-0.5 rounded-md bg-field p-0.5">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="switch"
            aria-checked={allowEdits === value}
            data-testid={value ? 'chat-allow-edits' : 'chat-ask-only'}
            disabled={busy}
            onClick={() => {
              if (allowEdits !== value) onChange(value);
            }}
            className={`rounded px-1 py-1 text-[11px] cursor-pointer ${
              allowEdits === value
                ? 'bg-card-solid text-ink shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {value ? t('agentSettings.edit') : t('agentSettings.ask')}
          </button>
        ))}
      </div>
      <span className="text-[10px] text-ink-faint">
        {allowEdits ? t('agentSettings.editHint') : t('readOnlyNotice')}
      </span>
    </div>
  );
}

function useCloseOnOutside(open: boolean, close: () => void) {
  const rootRef = useRef<HTMLDivElement | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target) !== true) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return rootRef;
}

type SettingsChipProps = {
  readonly open: boolean;
  readonly allowEdits: boolean;
  readonly choice: AgentRunChoice | undefined;
  readonly models: readonly AgentModelOption[] | undefined;
  readonly used: number | undefined;
  readonly onToggle: () => void;
};

/** `✦ Sonnet · Cao ▾`, an eye in Ask mode, the border warns as the limits run out. */
function SettingsChip({ open, allowEdits, choice, models, used, onToggle }: SettingsChipProps) {
  const { t } = useTranslation('chat');
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
      title={allowEdits ? t('agentSettings.title') : t('readOnlyNotice')}
      onClick={onToggle}
      className={`flex max-w-full min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-ink-soft hover:text-ink cursor-pointer ${ringClass(used)}`}
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

type SettingsPopoverProps = {
  readonly agent: AgentStatus;
  readonly allowEdits: boolean;
  readonly choice: AgentRunChoice | undefined;
  readonly models: readonly AgentModelOption[] | undefined;
  readonly usage: AgentUsageView | undefined;
  readonly busy: boolean;
  readonly onSave: (patch: AiPatch) => void;
};

function SettingsPopover({
  agent,
  allowEdits,
  choice,
  models,
  usage,
  busy,
  onSave,
}: SettingsPopoverProps) {
  const { t } = useTranslation('chat');
  return (
    <div
      role="dialog"
      aria-label={t('agentSettings.title')}
      data-testid="agent-settings-popover"
      className="absolute bottom-full right-0 z-30 mb-1 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-border bg-card-solid p-3 shadow-lg"
    >
      <AgentBadge agent={agent} />
      <ModelAndEffort
        agentId={agent.id}
        choice={choice}
        models={models}
        busy={busy}
        onChange={(next) => {
          onSave({ choice: next });
        }}
      />
      <EditModeSwitch
        allowEdits={allowEdits}
        busy={busy}
        onChange={(next) => {
          onSave({ allowEdits: next });
        }}
      />
      <div className="border-t border-line pt-2">
        <UsageSection agentId={agent.id} usage={usage} />
      </div>
    </div>
  );
}

/** Saves one change at a time; `busy` locks the controls meanwhile. */
function useAiSaver(agentId: AgentStatus['id']) {
  const [busy, setBusy] = useState(false);
  const save = async (patch: AiPatch) => {
    setBusy(true);
    try {
      await saveAi(agentId, patch);
    } catch {
      // Keep the previous pick on failure.
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

export function AgentSettings({ agent }: { readonly agent: AgentStatus }) {
  const [open, setOpen] = useState(false);
  const { busy, save } = useAiSaver(agent.id);
  const ai = normalizeWorkspaceAi(useProjectStore((s) => s.project?.ai));
  const usage = useUsageStore((s) => s.byAgent[agent.id]);
  const models = useModels(agent.id, open);
  const rootRef = useCloseOnOutside(open, () => {
    setOpen(false);
  });

  useEffect(() => {
    useUsageStore.getState().setCurrent(agent.id);
  }, [agent.id]);

  const choice = ai.agents?.[agent.id];

  return (
    <div
      className="relative min-w-0"
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
    >
      <SettingsChip
        open={open}
        allowEdits={ai.allowEdits}
        choice={choice}
        models={models}
        used={highestUse(usage)}
        onToggle={() => {
          setOpen((v) => !v);
        }}
      />
      {open && (
        <SettingsPopover
          agent={agent}
          allowEdits={ai.allowEdits}
          choice={choice}
          models={models}
          usage={usage}
          busy={busy}
          onSave={(patch) => void save(patch)}
        />
      )}
    </div>
  );
}
