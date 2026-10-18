// Structure action buttons (Move, Wrap, Unwrap, Duplicate, Remove) in Inspector Header (SPEC-04 R-SE-24..28).
import { useTranslation } from 'react-i18next';

import { errorText } from '../../../routes/error-text.ts';
import type { InspectorTarget } from '../types.ts';
import { useStructureActions } from './use-structure-actions.ts';

type StructureActionsProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
};

type ActionButtonsProps = {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly actions: ReturnType<typeof useStructureActions>;
};

function MoveButtons({ target, actions }: ActionButtonsProps) {
  const { t } = useTranslation();
  const tag = target.source?.tag;
  const baseDisabled =
    actions.pending || target.loading || tag === undefined || target.source?.readonly !== undefined;

  return (
    <>
      <button
        type="button"
        data-testid="inspector-move-up"
        disabled={baseDisabled || actions.moveUpTarget === undefined}
        onClick={() => {
          void actions.runMove('up');
        }}
        className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-ink hover:bg-border/20 disabled:opacity-50"
      >
        {t('inspector.moveUp')}
      </button>
      <button
        type="button"
        data-testid="inspector-move-down"
        disabled={baseDisabled || actions.moveDownTarget === undefined}
        onClick={() => {
          void actions.runMove('down');
        }}
        className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-ink hover:bg-border/20 disabled:opacity-50"
      >
        {t('inspector.moveDown')}
      </button>
    </>
  );
}

function WrapButtons({ target, actions }: ActionButtonsProps) {
  const { t } = useTranslation();
  const tag = target.source?.tag;
  const isUppercaseTag = tag !== undefined && /^[A-Z]/.test(tag);
  const baseDisabled =
    actions.pending || target.loading || tag === undefined || target.source?.readonly !== undefined;

  return (
    <>
      <select
        data-testid="inspector-wrap"
        disabled={baseDisabled}
        defaultValue=""
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'row' || val === 'column' || val === 'grid') {
            void actions.runWrap(val);
            e.target.value = '';
          }
        }}
        className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-ink hover:bg-border/20 disabled:opacity-50"
      >
        <option value="" disabled>
          {t('inspector.wrap')}
        </option>
        <option value="row">{t('inspector.wrapRow')}</option>
        <option value="column">{t('inspector.wrapColumn')}</option>
        <option value="grid">{t('inspector.wrapGrid')}</option>
      </select>
      <button
        type="button"
        data-testid="inspector-unwrap"
        disabled={baseDisabled || isUppercaseTag}
        onClick={() => {
          void actions.runUnwrap();
        }}
        className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-ink hover:bg-border/20 disabled:opacity-50"
      >
        {t('inspector.unwrap')}
      </button>
    </>
  );
}

function DuplicateAndRemoveButtons({ target, actions }: ActionButtonsProps) {
  const { t } = useTranslation();
  const tag = target.source?.tag;
  const baseDisabled =
    actions.pending || target.loading || tag === undefined || target.source?.readonly !== undefined;

  return (
    <>
      <button
        type="button"
        data-testid="inspector-duplicate"
        disabled={baseDisabled}
        onClick={() => {
          void actions.runDuplicate();
        }}
        className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-ink hover:bg-border/20 disabled:opacity-50"
      >
        {t('inspector.duplicate')}
      </button>
      <button
        type="button"
        data-testid="inspector-remove"
        disabled={baseDisabled}
        onClick={() => {
          void actions.runRemove();
        }}
        className="h-6 rounded border border-border/60 bg-field px-2 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        {t('inspector.remove')}
      </button>
    </>
  );
}

export function StructureActions({ target }: StructureActionsProps) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const actions = useStructureActions(target);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <MoveButtons target={target} actions={actions} />
        <WrapButtons target={target} actions={actions} />
        <DuplicateAndRemoveButtons target={target} actions={actions} />
      </div>
      {actions.errorInfo !== undefined && (
        <p role="alert" className="text-xs text-danger" data-testid="structure-action-error">
          {errorText(tError, actions.errorInfo.code, actions.errorInfo.params)}
        </p>
      )}
      {actions.warnings.length > 0 && (
        <div
          className="flex flex-col gap-1 text-xs text-amber-600"
          data-testid="structure-action-warnings"
        >
          {actions.warnings.map((w) => (
            <span key={w}>{t(`inspector.warning.${w}`, { defaultValue: w })}</span>
          ))}
        </div>
      )}
    </div>
  );
}
