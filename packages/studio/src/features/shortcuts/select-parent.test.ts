// Esc selects the parent on the Canvas too (spec-log #129): it used to change only the Studio's
// selection, so the Canvas kept the child and its size handles and free moves acted on the child.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { selectParentNode } from './shortcut-actions.ts';

const card = { loc: 'src/pages/Home.tsx:4:7', index: 0 };
const title = { loc: 'src/pages/Home.tsx:5:9', index: 0 };

beforeEach(() => {
  useSelectionStore.getState().reset();
  useCanvasViewStore.setState({ tool: 'select' });
  useSelectionStore.getState().setTree([
    { ref: card, tag: 'div', instances: 1 },
    { ref: title, tag: 'h3', parent: 0, instances: 1 },
  ]);
  useSelectionStore.getState().setSelectedRefs([title]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('selectParentNode [R-SL, spec-log #129]', () => {
  it('selects the parent in the Studio and on the Canvas', () => {
    const select = vi.spyOn(studioBridgeChannel, 'select').mockImplementation(() => undefined);
    expect(selectParentNode()).toBe(true);
    expect(useSelectionStore.getState().selectedRefs).toEqual([card]);
    expect(select).toHaveBeenCalledWith([card], true);
  });
});
