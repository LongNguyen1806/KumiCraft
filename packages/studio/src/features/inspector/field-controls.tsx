// Control inputs for the Inspector property fields (SPEC-04.1 section 11, R-IN-01, R-IN-02).
import type { DesignTokens, Spacing } from '@reactcraft/model';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FieldDescriptor } from './field-descriptors.ts';

/** Override indicator dot and popup to view base value or clear override (R-IN-02). */
export function FieldOverridePopover({
  id,
  baseValue,
  onClear,
}: {
  readonly id: string;
  readonly baseValue: string;
  readonly onClear: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        data-testid={`field-${id}-override`}
        onClick={() => {
          setOpen(!open);
        }}
        className="h-2.5 w-2.5 rounded-full bg-amber-500 hover:scale-125 transition-transform"
        title={t('inspector.clearOverride')}
      />
      {open && (
        <div className="absolute right-0 top-4 z-50 flex flex-col gap-1 rounded bg-card-solid p-2 text-xs shadow-md border border-edge min-w-[120px]">
          <span className="text-ink-faint">{t('inspector.baseValue')}</span>
          <span data-testid={`field-${id}-base`} className="font-mono font-medium">
            {baseValue}
          </span>
          <button
            type="button"
            data-testid={`field-${id}-clear`}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="mt-1 rounded bg-field px-1.5 py-0.5 text-ink hover:bg-edge text-left"
          >
            {t('inspector.clearOverride')}
          </button>
        </div>
      )}
    </div>
  );
}

function EnumInput({
  rawVal,
  disabled,
  onCommit,
}: {
  readonly rawVal: unknown;
  readonly disabled?: boolean | undefined;
  readonly onCommit: (val: 'row' | 'column') => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      data-testid="field-direction-input"
      disabled={disabled}
      value={typeof rawVal === 'string' ? rawVal : 'column'}
      onChange={(e) => {
        onCommit(e.target.value as 'row' | 'column');
      }}
      className="h-7 w-full rounded border border-edge bg-field px-2 text-xs text-ink disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-accent"
    >
      <option value="row">{t('inspector.directionRow')}</option>
      <option value="column">{t('inspector.directionColumn')}</option>
    </select>
  );
}

function TokenInput({
  id,
  rawVal,
  tokens,
  onCommit,
}: {
  readonly id: string;
  readonly rawVal: unknown;
  readonly tokens: DesignTokens | undefined;
  readonly onCommit: (val: Spacing) => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      data-testid={`field-${id}-token`}
      value={typeof rawVal === 'string' && rawVal.startsWith('token:') ? rawVal : ''}
      onChange={(e) => {
        onCommit(e.target.value as Spacing);
      }}
      className="h-7 w-full rounded border border-edge bg-field px-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
    >
      <option value="" disabled>
        {t('inspector.selectToken')}
      </option>
      {Object.entries(tokens?.spacing ?? {}).map(([name, entry]) => (
        <option key={name} value={`token:spacing.${name}`}>
          {`${name} · ${String(entry.value.px)} px`}
        </option>
      ))}
    </select>
  );
}

function PxInput({
  descriptor,
  initialDraft,
  onCommit,
}: {
  readonly descriptor: FieldDescriptor;
  readonly initialDraft: string;
  readonly onCommit: (val: Spacing | number) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialDraft);
  const isValid = draft === '' || descriptor.validate(draft);

  const commitDraft = () => {
    if (!descriptor.validate(draft)) return;
    const num = Number(draft.trim());
    if (descriptor.kind === 'number') onCommit(num);
    else onCommit({ px: num });
  };

  return (
    <input
      type="text"
      data-testid={`field-${descriptor.id}-input`}
      value={draft}
      aria-invalid={!isValid}
      title={
        !isValid && descriptor.validationMessageKey ? t(descriptor.validationMessageKey) : undefined
      }
      onChange={(e) => {
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitDraft();
      }}
      onBlur={commitDraft}
      className={`h-7 w-full rounded border bg-field px-2 text-xs text-ink focus:outline-none ${
        isValid
          ? 'border-edge focus:ring-1 focus:ring-accent'
          : 'border-red-500 ring-1 ring-red-500'
      }`}
    />
  );
}

export function FieldControl({
  descriptor,
  activeMode,
  rawVal,
  initialDraft,
  tokens,
  disabled,
  onCommit,
}: {
  readonly descriptor: FieldDescriptor;
  readonly activeMode: 'px' | 'token';
  readonly rawVal: unknown;
  readonly initialDraft: string;
  readonly tokens: DesignTokens | undefined;
  readonly disabled?: boolean | undefined;
  readonly onCommit: (val: Spacing | number | 'row' | 'column') => void;
}) {
  if (descriptor.kind === 'enum') {
    return <EnumInput rawVal={rawVal} disabled={disabled} onCommit={onCommit} />;
  }
  if (activeMode === 'token' && descriptor.hasToken) {
    return <TokenInput id={descriptor.id} rawVal={rawVal} tokens={tokens} onCommit={onCommit} />;
  }
  return <PxInput descriptor={descriptor} initialDraft={initialDraft} onCommit={onCommit} />;
}
