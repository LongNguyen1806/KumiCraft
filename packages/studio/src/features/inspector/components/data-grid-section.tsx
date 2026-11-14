// Inline Excel-like table editor for `.data.ts` arrays bound via `.map()` (TK-32).
import type { DataArrayRow, DataPrimitiveValue, ElementDataContext } from '@kumicraft/shared';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { coerceCellInput, useDataGridState } from './data-grid-hooks.ts';
import { InspectorGroup } from './inspector-group.tsx';

const COL_RE = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

function DataCellInput({
  value,
  rowIndex,
  col,
  disabled,
  onChange,
}: {
  readonly value: DataPrimitiveValue | undefined;
  readonly rowIndex: number;
  readonly col: string;
  readonly disabled: boolean;
  readonly onChange: (next: DataPrimitiveValue) => void;
}) {
  if (typeof value === 'boolean') {
    return (
      <input
        type="checkbox"
        aria-label={`${col} #${String(rowIndex + 1)}`}
        data-testid={`data-cell-${String(rowIndex)}-${col}`}
        checked={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
    );
  }
  return (
    <input
      type={typeof value === 'number' ? 'number' : 'text'}
      aria-label={`${col} #${String(rowIndex + 1)}`}
      data-testid={`data-cell-${String(rowIndex)}-${col}`}
      value={value !== undefined ? String(value) : ''}
      disabled={disabled}
      onChange={(e) => {
        onChange(coerceCellInput(e.target.value, value));
      }}
      className="w-full min-w-[64px] rounded border border-line bg-card-solid px-1.5 py-0.5 text-[11px] text-ink"
    />
  );
}

function AddColumnBar({
  disabled,
  onAddColumn,
}: {
  readonly disabled: boolean;
  readonly onAddColumn: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [colName, setColName] = useState('');
  const valid = COL_RE.test(colName.trim());

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        data-testid="data-grid-col-name"
        placeholder={t('dataTools.columnNamePlaceholder')}
        value={colName}
        disabled={disabled}
        onChange={(e) => {
          setColName(e.target.value);
        }}
        className="h-6 min-w-0 flex-1 rounded border border-line bg-card-solid px-1.5 text-[11px] text-ink"
      />
      <button
        type="button"
        data-testid="data-grid-add-col"
        disabled={disabled || !valid}
        onClick={() => {
          onAddColumn(colName.trim());
          setColName('');
        }}
        className="inline-flex h-6 items-center gap-1 rounded border border-line bg-field px-2 text-[11px] text-ink hover:bg-card-solid disabled:opacity-40"
      >
        <Plus className="size-3" aria-hidden />
        <span>{t('dataTools.addColumn')}</span>
      </button>
    </div>
  );
}

function RowActionButton({
  label,
  disabled,
  testId,
  danger,
  onClick,
  children,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly testId?: string | undefined;
  readonly danger?: boolean | undefined;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  const tone = danger ? 'text-danger hover:bg-danger/10' : 'text-ink-soft hover:bg-field';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={`rounded p-0.5 disabled:opacity-30 ${tone}`}
    >
      {children}
    </button>
  );
}

function DataGridRowActions({
  rowIndex,
  rowCount,
  disabled,
  onMove,
  onDelete,
}: {
  readonly rowIndex: number;
  readonly rowCount: number;
  readonly disabled: boolean;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <td className="p-1 whitespace-nowrap">
      <RowActionButton
        label={t('dataTools.moveUp')}
        disabled={disabled || rowIndex === 0}
        onClick={() => {
          onMove(-1);
        }}
      >
        <ArrowUp className="size-3" aria-hidden />
      </RowActionButton>
      <RowActionButton
        label={t('dataTools.moveDown')}
        disabled={disabled || rowIndex === rowCount - 1}
        onClick={() => {
          onMove(1);
        }}
      >
        <ArrowDown className="size-3" aria-hidden />
      </RowActionButton>
      <RowActionButton
        label={t('dataTools.deleteRow')}
        disabled={disabled}
        testId={`data-grid-delete-${String(rowIndex)}`}
        danger
        onClick={onDelete}
      >
        <Trash2 className="size-3" aria-hidden />
      </RowActionButton>
    </td>
  );
}

function DataGridTableRow({
  columns,
  row,
  rowIndex,
  rowCount,
  saving,
  onUpdateCell,
  onMoveRow,
  onDeleteRow,
}: {
  readonly columns: readonly string[];
  readonly row: DataArrayRow;
  readonly rowIndex: number;
  readonly rowCount: number;
  readonly saving: boolean;
  readonly onUpdateCell: (rowIdx: number, col: string, next: DataPrimitiveValue) => void;
  readonly onMoveRow: (rowIdx: number, delta: -1 | 1) => void;
  readonly onDeleteRow: (rowIdx: number) => void;
}) {
  return (
    <tr className="border-b border-line last:border-b-0">
      {columns.map((col) => (
        <td key={col} className="p-1">
          <DataCellInput
            value={row[col]}
            rowIndex={rowIndex}
            col={col}
            disabled={saving}
            onChange={(v) => {
              onUpdateCell(rowIndex, col, v);
            }}
          />
        </td>
      ))}
      <DataGridRowActions
        rowIndex={rowIndex}
        rowCount={rowCount}
        disabled={saving}
        onMove={(delta) => {
          onMoveRow(rowIndex, delta);
        }}
        onDelete={() => {
          onDeleteRow(rowIndex);
        }}
      />
    </tr>
  );
}

function DataGridTableHeader({ columns }: { readonly columns: readonly string[] }) {
  return (
    <thead>
      <tr className="bg-field text-left text-ink-soft">
        {columns.map((c) => (
          <th key={c} className="border-b border-line px-1.5 py-1 font-medium">
            {c}
          </th>
        ))}
        <th className="w-16 border-b border-line px-1 py-1" />
      </tr>
    </thead>
  );
}

function DataGridTable({
  columns,
  rows,
  saving,
  onUpdateCell,
  onMoveRow,
  onDeleteRow,
}: {
  readonly columns: readonly string[];
  readonly rows: readonly DataArrayRow[];
  readonly saving: boolean;
  readonly onUpdateCell: (rowIdx: number, col: string, next: DataPrimitiveValue) => void;
  readonly onMoveRow: (rowIdx: number, delta: -1 | 1) => void;
  readonly onDeleteRow: (rowIdx: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded border border-line">
      <table className="w-full border-collapse text-[11px]">
        <DataGridTableHeader columns={columns} />
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-2 py-2 text-center text-ink-faint">
                {t('dataTools.emptyRows')}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <DataGridTableRow
                key={String(idx)}
                columns={columns}
                row={row}
                rowIndex={idx}
                rowCount={rows.length}
                saving={saving}
                onUpdateCell={onUpdateCell}
                onMoveRow={onMoveRow}
                onDeleteRow={onDeleteRow}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DataGridEditorBody({
  ctx,
  onSaved,
}: {
  readonly ctx: ElementDataContext;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation();
  const state = useDataGridState(ctx, onSaved);
  return (
    <div className="flex flex-col gap-2">
      <DataGridTable
        columns={state.columns}
        rows={state.rows}
        saving={state.saving}
        onUpdateCell={state.updateCell}
        onMoveRow={state.moveRow}
        onDeleteRow={state.deleteRow}
      />
      <AddColumnBar disabled={state.saving} onAddColumn={state.addColumn} />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="data-grid-add-row"
          disabled={state.saving}
          onClick={state.addRow}
          className="inline-flex h-6 items-center gap-1 rounded border border-line bg-field px-2 text-[11px] text-ink hover:bg-card-solid disabled:opacity-40"
        >
          <Plus className="size-3" aria-hidden />
          <span>{t('dataTools.addRow')}</span>
        </button>
        <button
          type="button"
          data-testid="data-grid-save"
          disabled={state.saving}
          onClick={() => {
            void state.save();
          }}
          className="inline-flex h-6 items-center gap-1 rounded bg-accent px-2.5 text-[11px] font-medium text-white disabled:opacity-40"
        >
          <Save className="size-3" aria-hidden />
          <span>{state.saving ? t('dataTools.savingData') : t('dataTools.saveData')}</span>
        </button>
      </div>
    </div>
  );
}

export function DataGridSection({
  dataContext,
  onSaved,
}: {
  readonly dataContext?: ElementDataContext | undefined;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation();
  if (dataContext === undefined) return undefined;

  return (
    <InspectorGroup
      id="data-grid"
      title={t('dataTools.gridTitle', { name: dataContext.exportName })}
      setCount={dataContext.rows.length}
      defaultOpen={true}
      testId="data-grid"
    >
      {dataContext.readonlyReason !== undefined ? (
        <p
          data-testid="data-grid-readonly"
          className="rounded bg-sun-soft px-2 py-1.5 text-[11px] text-warn"
        >
          {t('dataTools.readonlyBanner', { reason: dataContext.readonlyReason })}
        </p>
      ) : (
        <DataGridEditorBody
          key={`${dataContext.file}:${dataContext.exportName}`}
          ctx={dataContext}
          onSaved={onSaved}
        />
      )}
    </InspectorGroup>
  );
}
