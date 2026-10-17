// Structure action buttons (Duplicate, Remove) in Inspector Header (SPEC-04 R-SE-25, R-SE-26).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStructureEdit } from '../../../api/source-client.ts';
import { type ErrorInfo, errorText, toErrorInfo } from '../../../routes/error-text.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import type { InspectorTarget } from '../types.ts';

type StructureActionsProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

type ActionErrorState = {
  readonly targetKey: string;
  readonly info: ErrorInfo;
};

function useStructureActionHandlers(loc: string, tag: string | undefined, targetKey: string) {
  const setSelectedRefs = useSelectionStore((s) => s.setSelectedRefs);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const [pending, setPending] = useState(false);
  const [errorState, setErrorState] = useState<ActionErrorState>();

  const runAction = (kind: 'duplicate' | 'remove') => {
    if (!tag) return;
    setPending(true);
    setErrorState(undefined);
    void (async () => {
      try {
        const res = await applyStructureEdit({ kind, elements: [{ loc, tag }] });
        if (kind === 'duplicate') {
          const newLoc = res.locs[0];
          if (newLoc) setSelectedRefs([{ loc: newLoc, index: 0 }]);
        } else {
          clearSelection();
        }
      } catch (err) {
        setErrorState({ targetKey, info: toErrorInfo(err) });
      } finally {
        setPending(false);
      }
    })();
  };

  const errorInfo = errorState?.targetKey === targetKey ? errorState.info : undefined;
  return { pending, errorInfo, runAction };
}

export function StructureActions({ target }: StructureActionsProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const tag = target.source?.tag;
  const targetKey = `${target.ref.loc}#${String(target.ref.index)}`;
  const { pending, errorInfo, runAction } = useStructureActionHandlers(
    target.ref.loc,
    tag,
    targetKey,
  );
  const disabled =
    pending || target.loading || tag === undefined || target.source?.readonly !== undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="inspector-duplicate"
          disabled={disabled}
          onClick={() => {
            runAction('duplicate');
          }}
          className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-ink hover:bg-border/20 disabled:opacity-50"
        >
          {t('inspector.duplicate')}
        </button>
        <button
          type="button"
          data-testid="inspector-remove"
          disabled={disabled}
          onClick={() => {
            runAction('remove');
          }}
          className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          {t('inspector.remove')}
        </button>
      </div>
      {errorInfo !== undefined && (
        <p role="alert" className="text-xs text-danger" data-testid="structure-action-error">
          {errorText(tError, errorInfo.code, errorInfo.params)}
        </p>
      )}
    </div>
  );
}
