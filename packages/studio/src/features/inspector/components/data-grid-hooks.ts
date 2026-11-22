// State hooks and row helpers for the inline `.data.ts` editor grid (TK-32).
import type { DataArrayRow, DataPrimitiveValue, ElementDataContext } from '@kumicraft/shared';
import { useState } from 'react';

import { sendStructureEdit } from '../../../core/edits.ts';

function coerceCellInput(
  raw: string,
  previous: DataPrimitiveValue | undefined,
): DataPrimitiveValue {
  if (typeof previous === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return raw;
}

function buildEmptyRow(
  columns: readonly string[],
  template: DataArrayRow | undefined,
): DataArrayRow {
  const emptyRow: Record<string, DataPrimitiveValue> = {};
  for (const c of columns) {
    const prevVal = template?.[c];
    emptyRow[c] = typeof prevVal === 'number' ? 0 : typeof prevVal === 'boolean' ? false : '';
  }
  return emptyRow;
}

function swapRows(
  prev: readonly DataArrayRow[],
  rowIdx: number,
  delta: -1 | 1,
): readonly DataArrayRow[] {
  const a = prev[rowIdx];
  const b = prev[rowIdx + delta];
  if (a === undefined || b === undefined) return prev;
  const copy = [...prev];
  copy[rowIdx] = b;
  copy[rowIdx + delta] = a;
  return copy;
}

export { coerceCellInput };

/** Manages editable columns/rows state and atomic save for DataGridSection. */
export function useDataGridState(ctx: ElementDataContext, onSaved: () => void) {
  const [columns, setColumns] = useState<readonly string[]>(ctx.columns);
  const [rows, setRows] = useState<readonly DataArrayRow[]>(ctx.rows);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await sendStructureEdit({
        kind: 'setDataArray',
        file: ctx.file,
        exportName: ctx.exportName,
        rows,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return {
    columns,
    rows,
    saving,
    updateCell: (rowIdx: number, col: string, next: DataPrimitiveValue) => {
      setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [col]: next } : r)));
    },
    moveRow: (rowIdx: number, delta: -1 | 1) => {
      setRows((prev) => swapRows(prev, rowIdx, delta));
    },
    deleteRow: (idx: number) => {
      setRows((prev) => prev.filter((_, i) => i !== idx));
    },
    addRow: () => {
      setRows((prev) => [...prev, buildEmptyRow(columns, prev[prev.length - 1])]);
    },
    addColumn: (name: string) => {
      if (columns.includes(name)) return;
      setColumns((prev) => [...prev, name]);
      setRows((prev) => prev.map((r) => ({ ...r, [name]: '' })));
    },
    save,
  };
}
