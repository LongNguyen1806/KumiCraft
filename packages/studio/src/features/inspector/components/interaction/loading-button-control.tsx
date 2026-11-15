// LoadingButton conversion control (K9.8-1 TK-77).
import type { ElementSource } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyInteraction } from '../../../../api/interaction-client.ts';
import {
  interactionDisableReason,
  InteractionErrorNotice,
  ToolActionButton,
  useInteractionTask,
} from './interaction-shared.tsx';

export const LOADING_ELIGIBLE_TAGS = new Set(['button', 'a', 'LoadingButton']);

type InteractionControlProps = {
  readonly source: ElementSource;
  readonly onDone: () => void;
};

function getLoadingReasonKey(
  source: ElementSource,
): 'alreadyLoadingButton' | 'onlyButtonTag' | 'readonly' | 'insideLoop' | undefined {
  if (source.tag === 'LoadingButton') return 'alreadyLoadingButton';
  if (source.tag === 'a') return 'onlyButtonTag';
  return interactionDisableReason(source);
}

export function LoadingButtonControl({ source, onDone }: InteractionControlProps) {
  const { t } = useTranslation();
  const [loadingText, setLoadingText] = useState('');
  const { busy, error, run } = useInteractionTask(onDone);

  if (!LOADING_ELIGIBLE_TAGS.has(source.tag)) return undefined;
  const reasonKey = getLoadingReasonKey(source);
  const disabledReason =
    reasonKey !== undefined ? t(`interaction.reasons.${reasonKey}`) : undefined;

  return (
    <div className="flex flex-col gap-1 border-t border-line/60 pt-1.5">
      {disabledReason === undefined && (
        <input
          type="text"
          data-testid="loading-button-text-input"
          placeholder={t('interaction.loadingTextPlaceholder')}
          value={loadingText}
          onChange={(e) => {
            setLoadingText(e.target.value);
          }}
          className="h-[26px] rounded border border-line bg-card-solid px-2 text-[11px] text-ink"
        />
      )}
      <ToolActionButton
        testId="make-loading-button"
        label={t('interaction.makeLoadingButton')}
        tooltip={t('interaction.makeLoadingButtonTooltip')}
        disabledReason={disabledReason}
        busy={busy}
        onClick={() => {
          void run(() =>
            applyInteraction({
              action: 'makeLoadingButton',
              element: { loc: source.loc, tag: source.tag },
              ...(loadingText.trim() !== '' ? { loadingText: loadingText.trim() } : {}),
            }),
          );
        }}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}
