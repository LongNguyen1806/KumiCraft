// ScrollSpy active navigation wrapper control (K9.8-1 TK-80).
import type { ElementRef, ElementSource } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { applyInteraction } from '../../../../api/interaction-client.ts';
import { useSelectionStore } from '../../../selection/selection-store.ts';
import {
  collectDescendants,
  interactionDisableReason,
  InteractionErrorNotice,
  ToolActionButton,
  useInteractionTask,
} from './interaction-shared.tsx';

const NAV_TAGS = new Set(['nav', 'ul', 'div', 'header', 'ScrollSpy']);

export function ScrollSpyControl({
  source,
  refTarget,
  onDone,
}: {
  readonly source: ElementSource;
  readonly refTarget: ElementRef;
  readonly onDone: () => void;
}) {
  const { t } = useTranslation();
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const { busy, error, run } = useInteractionTask(onDone);

  if (!NAV_TAGS.has(source.tag)) return undefined;
  const hasLinks = collectDescendants(treeNodes, refTarget).some(
    (n) => n.tag === 'a' || n.tag === 'Link',
  );
  if (source.tag !== 'nav' && source.tag !== 'ScrollSpy' && !hasLinks) return undefined;

  const baseReason = interactionDisableReason(source);
  const disabledReason =
    source.tag === 'ScrollSpy'
      ? t('interaction.reasons.alreadyScrollSpy')
      : !hasLinks && source.tag !== 'nav'
        ? t('interaction.reasons.needNavLinks')
        : baseReason !== undefined
          ? t(`interaction.reasons.${baseReason}`)
          : undefined;

  return (
    <div className="flex flex-col gap-1 border-t border-line/60 pt-1.5">
      <ToolActionButton
        testId="mark-active-nav"
        label={t('interaction.markActiveNav')}
        tooltip={t('interaction.markActiveNavTooltip')}
        disabledReason={disabledReason}
        busy={busy}
        onClick={() => {
          void run(() =>
            applyInteraction({
              action: 'markActiveNav',
              element: { loc: source.loc, tag: source.tag },
            }),
          );
        }}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}
