import type { InsertTarget, ProjectComponent } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useDndStore } from './dnd-store.ts';
import { handleDrop } from './drop-actions.ts';

describe('handleDrop with component source (Scenario #14) [R-CP-13, R-DD-14]', () => {
  const component: ProjectComponent = {
    name: 'Button',
    file: 'src/components/ui/Button.tsx',
    kind: 'component',
    usages: 4,
    importStatement: "import { Button } from '@/components/ui/Button';",
  };

  const target: InsertTarget = {
    kind: 'child',
    parent: { loc: 'src/pages/Home.tsx:10:1', tag: 'main' },
    where: 'end',
  };

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useDndStore.getState().endDrag();
    useDndStore.getState().setError(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls applyStructureEdit with component jsx and from imports (scenario 14)', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/pages/Home.tsx'],
      locs: ['src/pages/Home.tsx:20:5'],
    });

    useDndStore.getState().startDrag({ source: 'component', component });
    useDndStore.getState().setDropTarget(target);

    const ok = await handleDrop('vi');

    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledWith({
      kind: 'insert',
      target,
      jsx: '<Button />',
      from: {
        file: component.file,
        imports: [component.importStatement],
      },
    });
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/pages/Home.tsx:20:5', index: 0 },
    ]);
  });
});
