// Shared UI primitives and tree helpers for Inspector interaction tools (K9.8-1).
import type { ElementRef, ElementSource, TreeNode } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText, toErrorInfo } from '../../../../routes/error-text.ts';
import { askAiWithDraft } from '../../../chat/ask-ai-about-element.ts';

/**
 * Refusals that touch the whole project: KumiCraft does not add a second system next to the
 * project's own, and offers to hand the job to the AI tab instead (plan K9.8).
 */
const AI_REASONS = ['projectToastLibrary', 'projectToastHost'] as const;
type AiReason = (typeof AI_REASONS)[number];

function isAiReason(value: unknown): value is AiReason {
  return AI_REASONS.some((reason) => reason === value);
}

/** The string params of an error, to fill the prepared AI request. */
function stringParams(
  params: Readonly<Record<string, unknown>> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

export function useInteractionTask(onDone: () => void) {
  const { t: tError } = useTranslation('errors');
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [aiPrompt, setAiPrompt] = useState<string>();

  /** `context` fills the prepared AI request when the job is handed to the AI tab. */
  const run = async (
    task: () => Promise<unknown>,
    context?: Readonly<Record<string, string>>,
  ): Promise<void> => {
    setBusy(true);
    setError(undefined);
    setAiPrompt(undefined);
    try {
      await task();
      onDone();
    } catch (cause) {
      setError(formatApiError(cause, tError));
      const info = toErrorInfo(cause);
      const reason = info.params?.['reason'];
      if (isAiReason(reason)) {
        const values = { ...stringParams(info.params), ...context };
        setAiPrompt(
          t(`interaction.askAiPrompt.${reason}`, {
            library: values['library'] ?? '',
            file: values['file'] ?? '',
            message: values['message'] ?? '',
            loc: values['loc'] ?? '',
          }),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, aiPrompt, run };
}

export type NodeMatch = {
  readonly index: number;
  readonly node: TreeNode;
};

export function findTreeNodeIndex(treeNodes: readonly TreeNode[], ref: ElementRef): number {
  const exact = treeNodes.findIndex((n) => n.ref.loc === ref.loc && n.ref.index === ref.index);
  if (exact >= 0) return exact;
  return treeNodes.findIndex((n) => n.ref.loc === ref.loc);
}

export function directChildrenOf(treeNodes: readonly TreeNode[], ref: ElementRef): TreeNode[] {
  const parentIdx = findTreeNodeIndex(treeNodes, ref);
  if (parentIdx < 0) return [];
  return treeNodes.filter((n) => n.parent === parentIdx);
}

export function findParentIndex(
  treeNodes: readonly TreeNode[],
  ref: ElementRef,
): number | undefined {
  const idx = findTreeNodeIndex(treeNodes, ref);
  return idx >= 0 ? treeNodes[idx]?.parent : undefined;
}

export function collectDescendants(treeNodes: readonly TreeNode[], ref: ElementRef): TreeNode[] {
  const rootIdx = findTreeNodeIndex(treeNodes, ref);
  if (rootIdx < 0) return [];
  const included = new Set<number>([rootIdx]);
  const out: TreeNode[] = [];
  for (let i = 0; i < treeNodes.length; i += 1) {
    const node = treeNodes[i];
    if (node !== undefined && node.parent !== undefined && included.has(node.parent)) {
      included.add(i);
      out.push(node);
    }
  }
  return out;
}

export function formatApiError(cause: unknown, tError: TFunction<'errors'>): string {
  const info = toErrorInfo(cause);
  return errorText(tError, info.code, info.params);
}

export type InteractionDisableReasonKey = 'readonly' | 'insideLoop';

export function interactionDisableReason(
  source: ElementSource | undefined,
): InteractionDisableReasonKey | undefined {
  if (source === undefined) return undefined;
  if (source.readonly !== undefined) return 'readonly';
  if (source.inLoop) return 'insideLoop';
  return undefined;
}

export function ToolActionButton({
  testId,
  label,
  tooltip,
  disabled,
  disabledReason,
  busy,
  variant = 'default',
  onClick,
}: {
  readonly testId: string;
  readonly label: string;
  readonly tooltip: string;
  readonly disabled?: boolean | undefined;
  readonly disabledReason?: string | undefined;
  readonly busy?: boolean | undefined;
  readonly variant?: 'default' | 'primary' | 'danger' | undefined;
  readonly onClick: () => void;
}) {
  const isDisabled = disabled === true || disabledReason !== undefined || busy === true;
  const tone =
    variant === 'primary'
      ? 'border-accent bg-accent text-white hover:opacity-90'
      : variant === 'danger'
        ? 'border-line bg-card-solid text-danger hover:bg-sun-soft'
        : 'border-line bg-card-solid text-ink hover:bg-field';

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        data-testid={testId}
        title={disabledReason ?? tooltip}
        disabled={isDisabled}
        onClick={onClick}
        className={`h-[26px] w-full rounded border px-2 text-left text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
      >
        {label}
      </button>
      {disabledReason !== undefined && (
        <span data-testid={`${testId}-reason`} className="text-[10px] leading-snug text-ink-soft">
          {disabledReason}
        </span>
      )}
    </div>
  );
}

export function InteractionErrorNotice({
  error,
  aiPrompt,
}: {
  readonly error?: string | undefined;
  readonly aiPrompt?: string | undefined;
}) {
  const { t } = useTranslation();
  if (error === undefined) return undefined;
  if (aiPrompt !== undefined) {
    return (
      <div role="alert" data-testid="interaction-error" className="flex flex-col gap-1.5">
        <p className="text-[11px] leading-snug text-ink-soft">{error}</p>
        <button
          type="button"
          data-testid="interaction-ask-ai"
          title={t('interaction.askAiHint')}
          onClick={() => {
            askAiWithDraft(aiPrompt);
          }}
          className="h-7 self-start rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium text-ink hover:bg-field"
        >
          {t('interaction.askAi')}
        </button>
      </div>
    );
  }
  return (
    <p
      role="alert"
      data-testid="interaction-error"
      className="text-[11px] leading-snug text-danger"
    >
      {error} {t('interaction.fixHintSuffix')}
    </p>
  );
}
