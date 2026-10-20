// Computation of CSS grid cell rectangles for drop visual cues (R-FF-18, spec-log #30).
import type { DropRect } from './drop-target.ts';

export interface GridTracks {
  originX: number;
  originY: number;
  columns: readonly number[];
  rows: readonly number[];
  columnGap: number;
  rowGap: number;
}

const MAX_GRID_CELLS = 200;

function parseTrackList(raw: string): number[] {
  if (!raw || raw === 'none') return [];
  return raw
    .trim()
    .split(/\s+/)
    .map((s) => Number.parseFloat(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseGap(raw: string | undefined): number {
  if (!raw || raw === 'normal') return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function readGridTracks(el: Element): GridTracks | undefined {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style || !style.display.includes('grid')) return undefined;

  const columns = parseTrackList(style.gridTemplateColumns);
  const rows = parseTrackList(style.gridTemplateRows);
  if (columns.length === 0 || rows.length === 0) return undefined;

  const columnGap = parseGap(style.columnGap);
  const rowGap = parseGap(style.rowGap);

  const rect = el.getBoundingClientRect();
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;

  return {
    originX: rect.left + borderLeft + paddingLeft,
    originY: rect.top + borderTop + paddingTop,
    columns,
    rows,
    columnGap,
    rowGap,
  };
}

export function gridCells(tracks: GridTracks): DropRect[] {
  const cells: DropRect[] = [];
  let currentY = tracks.originY;

  for (let r = 0; r < tracks.rows.length; r++) {
    const rowHeight = tracks.rows[r];
    if (rowHeight === undefined) continue;
    let currentX = tracks.originX;

    for (let c = 0; c < tracks.columns.length; c++) {
      if (cells.length >= MAX_GRID_CELLS) return cells;
      const colWidth = tracks.columns[c];
      if (colWidth === undefined) continue;

      cells.push({
        x: currentX,
        y: currentY,
        width: colWidth,
        height: rowHeight,
      });
      currentX += colWidth + tracks.columnGap;
    }
    currentY += rowHeight + tracks.rowGap;
  }

  return cells;
}
