// Modal dialog for picking a TypeScript/Zod/Django/OpenAPI source and fields (TK-33, TK-35).
import type { DataField } from '@kumicraft/shared';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type DataPickerMode, submitDataInsert } from './data-insert.ts';
import { useDataSourcesLoader, useSourceFieldsLoader } from './data-source-picker-hooks.ts';

export type { DataPickerMode };

export function isDataGeneratorBlock(blockId: string): boolean {
  return blockId === 'data.form-from-source' || blockId === 'data.table-from-source';
}

export function dataGeneratorMode(blockId: string): DataPickerMode {
  return blockId === 'data.table-from-source' ? 'table' : 'form';
}

function FieldMoveButtons({
  index,
  total,
  onMove,
}: {
  readonly index: number;
  readonly total: number;
  readonly onMove: (delta: -1 | 1) => void;
}) {
  const { t } = useTranslation('library');
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        aria-label={t('dataPicker.moveUp')}
        title={t('dataPicker.moveUp')}
        disabled={index === 0}
        onClick={() => {
          onMove(-1);
        }}
        className="rounded p-0.5 text-ink-soft hover:bg-card-solid disabled:opacity-30"
      >
        <ArrowUp className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t('dataPicker.moveDown')}
        title={t('dataPicker.moveDown')}
        disabled={index === total - 1}
        onClick={() => {
          onMove(1);
        }}
        className="rounded p-0.5 text-ink-soft hover:bg-card-solid disabled:opacity-30"
      >
        <ArrowDown className="size-3" aria-hidden />
      </button>
    </div>
  );
}

function FieldRowItem({
  field,
  index,
  total,
  checked,
  onToggle,
  onMove,
}: {
  readonly field: DataField;
  readonly index: number;
  readonly total: number;
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly onMove: (delta: -1 | 1) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-line bg-field px-2 py-1 text-xs">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="checkbox"
          data-testid={`data-field-toggle-${field.name}`}
          checked={checked}
          onChange={onToggle}
        />
        <span className="truncate font-medium text-ink">{field.label}</span>
        <span className="shrink-0 font-mono text-[10px] text-ink-faint">{field.type}</span>
      </label>
      <FieldMoveButtons index={index} total={total} onMove={onMove} />
    </div>
  );
}

function FieldsChecklist({
  fieldsState,
}: {
  readonly fieldsState: ReturnType<typeof useSourceFieldsLoader>;
}) {
  const { t } = useTranslation('library');
  if (fieldsState.loading)
    return <p className="text-xs text-ink-soft">{t('dataPicker.loadingFields')}</p>;
  if (fieldsState.fields.length === 0)
    return <p className="text-xs text-ink-soft">{t('dataPicker.noFields')}</p>;
  return (
    <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
      {fieldsState.fields.map((field, idx) => (
        <FieldRowItem
          key={field.name}
          field={field}
          index={idx}
          total={fieldsState.fields.length}
          checked={fieldsState.enabledNames.has(field.name)}
          onToggle={() => {
            fieldsState.toggleField(field.name);
          }}
          onMove={(delta) => {
            fieldsState.moveField(idx, delta);
          }}
        />
      ))}
    </div>
  );
}

function PickerBody({
  sourcesState,
  fieldsState,
}: {
  readonly sourcesState: ReturnType<typeof useDataSourcesLoader>;
  readonly fieldsState: ReturnType<typeof useSourceFieldsLoader>;
}) {
  const { t } = useTranslation('library');
  if (sourcesState.loading)
    return <p className="py-4 text-xs text-ink-soft">{t('dataPicker.loadingSources')}</p>;
  if (sourcesState.sources.length === 0)
    return <p className="py-4 text-xs text-ink-soft">{t('dataPicker.emptySources')}</p>;
  return (
    <div className="flex flex-col gap-3">
      {sourcesState.yamlFiles.length > 0 && (
        <p className="rounded bg-sun-soft px-2 py-1 text-[11px] text-warn">
          {t('dataPicker.yamlNotice', { files: sourcesState.yamlFiles.join(', ') })}
        </p>
      )}
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-ink">{t('dataPicker.sourceLabel')}</span>
        <select
          data-testid="data-source-select"
          value={sourcesState.selectedId}
          onChange={(e) => {
            sourcesState.setSelectedId(e.target.value);
          }}
          className="h-8 rounded border border-line bg-field px-2 text-xs text-ink"
        >
          {sourcesState.sources.map((src) => (
            <option key={src.id} value={src.id}>
              {src.label} ({src.file})
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink">{t('dataPicker.fieldsTitle')}</span>
        <FieldsChecklist fieldsState={fieldsState} />
      </div>
    </div>
  );
}

function PickerDialogHeader({
  title,
  onClose,
}: {
  readonly title: string;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation('library');
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <button
        type="button"
        aria-label={t('dataPicker.cancel')}
        onClick={onClose}
        className="rounded p-1 text-ink-soft hover:bg-field"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function PickerDialogFooter({
  disabled,
  submitLabel,
  onClose,
  onConfirm,
}: {
  readonly disabled: boolean;
  readonly submitLabel: string;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation('library');
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        className="h-8 rounded border border-line px-3 text-xs text-ink hover:bg-field"
      >
        {t('dataPicker.cancel')}
      </button>
      <button
        type="button"
        data-testid="data-source-confirm"
        disabled={disabled}
        onClick={onConfirm}
        className="h-8 rounded bg-accent px-3 text-xs font-medium text-white disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function PickerModalCard({
  title,
  submitLabel,
  disabled,
  sourcesState,
  fieldsState,
  onClose,
  onConfirm,
}: {
  readonly title: string;
  readonly submitLabel: string;
  readonly disabled: boolean;
  readonly sourcesState: ReturnType<typeof useDataSourcesLoader>;
  readonly fieldsState: ReturnType<typeof useSourceFieldsLoader>;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="data-source-picker"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-line bg-card-solid p-4 shadow-xl">
        <PickerDialogHeader title={title} onClose={onClose} />
        <PickerBody sourcesState={sourcesState} fieldsState={fieldsState} />
        <PickerDialogFooter
          disabled={disabled}
          submitLabel={submitLabel}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

export function DataSourcePickerDialog({
  open,
  mode,
  onClose,
  onInserted,
}: {
  readonly open: boolean;
  readonly mode: DataPickerMode;
  readonly onClose: () => void;
  readonly onInserted?: (() => void) | undefined;
}) {
  const { t, i18n } = useTranslation('library');
  const sourcesState = useDataSourcesLoader(open);
  const selectedSource = sourcesState.sources.find((s) => s.id === sourcesState.selectedId);
  const fieldsState = useSourceFieldsLoader(open, selectedSource);
  const [busy, setBusy] = useState(false);

  if (!open) return undefined;
  const chosenFields = fieldsState.fields.filter((f) => fieldsState.enabledNames.has(f.name));

  const handleConfirm = async () => {
    if (chosenFields.length === 0 || busy) return;
    setBusy(true);
    try {
      if (
        await submitDataInsert(mode, selectedSource?.name ?? 'Row', chosenFields, i18n.language)
      ) {
        onInserted?.();
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PickerModalCard
      title={mode === 'form' ? t('dataPicker.titleForm') : t('dataPicker.titleTable')}
      submitLabel={mode === 'form' ? t('dataPicker.insertForm') : t('dataPicker.insertTable')}
      disabled={busy || chosenFields.length === 0}
      sourcesState={sourcesState}
      fieldsState={fieldsState}
      onClose={onClose}
      onConfirm={() => {
        void handleConfirm();
      }}
    />
  );
}
