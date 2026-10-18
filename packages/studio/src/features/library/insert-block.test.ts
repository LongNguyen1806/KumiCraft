import { LIBRARY_BLOCKS, type TreeNode } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { insertBlock } from './insert-block.ts';

describe('insertBlock (Scenario #13) [R-CP-11]', () => {
  const homeMainRef = { loc: 'src/pages/Home.tsx:20:7', index: 0 };
  const layoutDivRef = { loc: 'src/layouts/MainLayout.tsx:10:5', index: 0 };
  const headerRef = { loc: 'src/components/Header.tsx:5:3', index: 0 };

  const treeNodes: readonly TreeNode[] = [
    {
      ref: homeMainRef,
      tag: 'main',
      instances: 1,
    },
    {
      ref: layoutDivRef,
      parent: 0,
      tag: 'div',
      instances: 1,
    },
    {
      ref: headerRef,
      parent: 1,
      tag: 'header',
      instances: 1,
    },
  ];

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useDesignStore.getState().setTarget(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts into main of Home when selected element belongs to Header.tsx (scenario 13)', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/pages/Home.tsx'],
      locs: ['src/pages/Home.tsx:35:5'],
    });

    useDesignStore.getState().setTarget({
      kind: 'page',
      name: 'Home',
      file: 'src/pages/Home.tsx',
      route: '/',
    });
    useSelectionStore.getState().setTree([...treeNodes]);
    useSelectionStore.getState().setSelectedRefs([headerRef]);

    const paragraphBlock = LIBRARY_BLOCKS.find((b) => b.id === 'content.paragraph');
    if (!paragraphBlock) throw new Error('Missing paragraph block');

    const result = await insertBlock(paragraphBlock, 'vi');

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'insert',
        target: {
          kind: 'child',
          parent: { loc: homeMainRef.loc, tag: 'main' },
          where: 'end',
        },
      }),
    );
  });
});
