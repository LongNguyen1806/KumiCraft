// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DragController } from './drag.ts';
import type { DropEnv, DropRect } from './drop-target.ts';
import { gridCells, type GridTracks, readGridTracks } from './grid-cells.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('grid-cells [R-DD-13]', () => {
  it('[R-DD-13] scenario 11: gridCells generates correct cell coordinates', () => {
    const tracks: GridTracks = {
      originX: 10,
      originY: 5,
      columns: [100, 100, 100],
      rows: [50, 50],
      columnGap: 10,
      rowGap: 20,
    };

    const cells = gridCells(tracks);
    expect(cells).toHaveLength(6);

    // Row 2, Col 3 (0-indexed: r = 1, c = 2)
    // x = 10 + (100 + 100) + 2 * 10 = 230
    // y = 5 + 50 + 1 * 20 = 75
    // width = 100, height = 50
    const cellR1C2 = cells[1 * 3 + 2];
    expect(cellR1C2).toEqual({
      x: 230,
      y: 75,
      width: 100,
      height: 50,
    });
  });

  it('[R-DD-13] scenario 12: readGridTracks returns undefined for non-grid element', () => {
    const el = document.createElement('div');
    el.style.display = 'flex';
    document.body.appendChild(el);

    const tracks = readGridTracks(el);
    expect(tracks).toBeUndefined();
  });

  it('[R-DD-13] scenario 13: DragController calls showGridCells when dragging over grid container', () => {
    document.body.innerHTML = '<section id="grid" data-rc-loc="src/Home.tsx:1:1"></section>';
    const gridEl = document.getElementById('grid');
    if (!gridEl) throw new Error('Missing #grid');

    const tracks: GridTracks = {
      originX: 10,
      originY: 5,
      columns: [100, 100, 100],
      rows: [50, 50],
      columnGap: 10,
      rowGap: 20,
    };
    const env: DropEnv = {
      hitTest: () => [gridEl],
      measure: () => ({ x: 0, y: 0, width: 340, height: 140 }),
      axisOf: () => 'grid',
      gridTracks: (el) => (el === gridEl ? tracks : undefined),
    };

    const gridCellsCalls: (readonly DropRect[] | undefined)[] = [];
    const controller = new DragController(
      env,
      {
        sendDropTarget: () => {},
        sendMoveIntent: () => {},
        showIndicator: () => {},
        showGridCells: (cells) => {
          gridCellsCalls.push(cells);
        },
      },
      window,
    );

    controller.studioDragOver({ source: 'library', x: 50, y: 50 });
    expect(gridCellsCalls.length).toBeGreaterThan(0);
    const lastCells = gridCellsCalls[gridCellsCalls.length - 1];
    expect(lastCells).toEqual(gridCells(tracks));

    controller.destroy();
  });

  it('[R-DD-13] scenario 14: DragController calls showGridCells(undefined) on pointerup or cancel', () => {
    document.body.innerHTML = '<section id="grid" data-rc-loc="src/Home.tsx:1:1"></section>';
    const gridEl = document.getElementById('grid');
    if (!gridEl) throw new Error('Missing #grid');

    const env: DropEnv = {
      hitTest: () => [gridEl],
      measure: () => ({ x: 0, y: 0, width: 300, height: 200 }),
      axisOf: () => 'grid',
    };

    const gridCellsCalls: (readonly DropRect[] | undefined)[] = [];
    const controller = new DragController(
      env,
      {
        sendDropTarget: () => {},
        sendMoveIntent: () => {},
        showIndicator: () => {},
        showGridCells: (cells) => {
          gridCellsCalls.push(cells);
        },
      },
      window,
    );

    controller.studioDragOver({ source: 'library', x: 50, y: 50 });
    controller.studioDragEnd(false);
    expect(gridCellsCalls[gridCellsCalls.length - 1]).toBeUndefined();

    controller.cancel();
    expect(gridCellsCalls[gridCellsCalls.length - 1]).toBeUndefined();

    controller.destroy();
  });
});
