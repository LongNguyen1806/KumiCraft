// Shared UI primitives and tree helpers for Inspector interaction tools (K9.8-1).
import type { ElementRef, ElementSource, TreeNode } from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText, toErrorInfo } from '../../../../routes/error-text.ts';

export function useInteractionTask(onDone: () => void) {
  const { t: tError } = useTranslation('errors');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (task: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      await task();
      onDone();
    } catch (cause) {
      setError(formatApiError(cause, tError));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
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

export function InteractionErrorNotice({ error }: { readonly error?: string | undefined }) {
  const { t } = useTranslation();
  if (error === undefined) return undefined;
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
