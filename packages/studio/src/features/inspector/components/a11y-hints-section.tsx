// Non-blocking accessibility hints in Inspector with 1-click alt & aria-label fixes (TK-65).
import type { ElementA11yInfo, ElementSource } from '@kumicraft/shared';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sendEdit } from '../../../core/edits.ts';
import { useSelectionStore } from '../../../core/selection-store.ts';
import type { InspectorTarget } from '../types.ts';

async function saveAriaLabel(source: ElementSource, value: string): Promise<void> {
  const current = source.attributes['aria-label'];
  const before = current?.kind === 'static' ? current.value : undefined;
  await sendEdit({
    edit: {
      kind: 'setAttribute',
      loc: source.loc,
      tag: source.tag,
      name: 'aria-label',
      before,
      after: value,
    },
  });
}

function AriaLabelQuickFix({
  source,
  disabled,
  onSaved,
}: {
  readonly source: ElementSource;
  readonly disabled: boolean;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [labelText, setLabelText] = useState('');
  const [busy, setBusy] = useState(false);

  const onApply = async () => {
    const trimmed = labelText.trim();
    if (!trimmed || busy || disabled) return;
    setBusy(true);
    try {
      await saveAriaLabel(source, trimmed);
      setLabelText('');
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1 pt-1">
      <input
        type="text"
        data-testid="a11y-aria-label-input"
        placeholder={t('a11y.ariaLabelPlaceholder')}
        value={labelText}
        disabled={disabled || busy}
        onChange={(e) => {
          setLabelText(e.target.value);
        }}
        className="h-6 min-w-0 flex-1 rounded border border-line bg-card-solid px-1.5 text-[11px] text-ink"
      />
      <button
        type="button"
        data-testid="a11y-fix-aria-label"
        disabled={disabled || busy || labelText.trim().length === 0}
        onClick={() => void onApply()}
        className="h-6 shrink-0 rounded bg-accent px-2 text-[11px] font-medium text-white disabled:opacity-40"
      >
        {t('a11y.fixAriaLabel')}
      </button>
    </div>
  );
}

function MissingAltRow({
  disabled,
  onFixAltEmpty,
}: {
  readonly disabled: boolean;
  readonly onFixAltEmpty: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{t('a11y.missingAlt')}</span>
      <button
        type="button"
        data-testid="a11y-fix-alt-empty"
        disabled={disabled}
        onClick={onFixAltEmpty}
        className="shrink-0 rounded border border-line bg-card-solid px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-field disabled:opacity-40"
      >
        {t('a11y.fixAltEmpty')}
      </button>
    </div>
  );
}

function collectA11yIssues(a11y: ElementA11yInfo | undefined): {
  readonly lowContrastRatio?: number | undefined;
  readonly missingAlt: boolean;
  readonly missingAccessibleName: boolean;
  readonly unlabeledInput: boolean;
} {
  const lowContrastRatio =
    a11y?.contrast !== undefined && a11y.contrast < 4.5 ? a11y.contrast : undefined;
  return {
    lowContrastRatio,
    missingAlt: a11y?.missingAlt === true,
    missingAccessibleName: a11y?.missingAccessibleName === true,
    unlabeledInput: a11y?.unlabeledInput === true,
  };
}

export function A11yHintsSection({
  target,
  disabled,
  onFixAltEmpty,
}: {
  readonly target: Extract<InspectorTarget, { readonly kind: 'element' }>;
  readonly disabled: boolean;
  readonly onFixAltEmpty: () => void;
}) {
  const { t } = useTranslation();
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const info = selectionInfo.find(
    (item) => item.ref.loc === target.ref.loc && item.ref.index === target.ref.index,
  );
  const issues = collectA11yIssues(info?.a11y);
  const hasAny =
    issues.lowContrastRatio !== undefined ||
    issues.missingAlt ||
    issues.missingAccessibleName ||
    issues.unlabeledInput;
  if (!hasAny || target.source === undefined) return undefined;

  return (
    <section
      data-testid="a11y-hints"
      aria-label={t('a11y.title')}
      className="my-1 flex flex-col gap-1.5 rounded-md border border-sun/60 bg-sun-soft/60 p-2 text-[11px] text-ink"
    >
      <div className="flex items-center gap-1 font-semibold text-warn">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
        <span>{t('a11y.title')}</span>
      </div>
      {issues.lowContrastRatio !== undefined && (
        <p data-testid="a11y-contrast-warning">
          {t('a11y.contrastLow', { ratio: issues.lowContrastRatio.toFixed(2) })}
        </p>
      )}
      {issues.missingAlt && <MissingAltRow disabled={disabled} onFixAltEmpty={onFixAltEmpty} />}
      {(issues.missingAccessibleName || issues.unlabeledInput) && (
        <div className="flex flex-col gap-0.5">
          <span>
            {issues.missingAccessibleName
              ? t('a11y.missingAccessibleName')
              : t('a11y.unlabeledInput')}
          </span>
          <AriaLabelQuickFix source={target.source} disabled={disabled} onSaved={target.refresh} />
        </div>
      )}
    </section>
  );
}
