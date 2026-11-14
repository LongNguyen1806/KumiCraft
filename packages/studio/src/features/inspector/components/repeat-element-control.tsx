// 1-click Repeat from list action for JSX elements (TK-31).
import { Repeat } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStructureEdit } from '../../../api/source-client.ts';
import { useEditMode } from '../../project/use-edit-mode.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import type { InspectorTarget } from '../types.ts';

export function RepeatElementControl({
  target,
}: {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
}) {
  const { t } = useTranslation();
  const editMode = useEditMode();
  const [busy, setBusy] = useState(false);
  const src = target.source;
  if (src === undefined || editMode === 'viewOnly') return undefined;

  const inLoop = src.inLoop;
  const disabled = busy || target.loading || src.readonly !== undefined || inLoop;

  const handleRepeat = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const res = await applyStructureEdit({
        kind: 'repeatElement',
        loc: src.loc,
        tag: src.tag,
      });
      const nextLoc = res.locs[0];
      if (nextLoc !== undefined) {
        useSelectionStore.getState().setSelectedRefs([{ loc: nextLoc, index: 0 }]);
      }
      target.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="repeat-from-element"
      disabled={disabled}
      title={inLoop ? t('dataTools.repeatDisabledInLoop') : t('dataTools.repeatButton')}
      onClick={() => {
        void handleRepeat();
      }}
      className="border-line bg-field text-ink-soft hover:border-border hover:text-ink inline-flex h-6 cursor-pointer items-center gap-1 self-start rounded border px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Repeat className="size-3" aria-hidden="true" />
      <span>{t('dataTools.repeatButton')}</span>
    </button>
  );
}
