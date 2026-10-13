import type { DesignDocument } from '@reactcraft/model';
import { describe, expect, it } from 'vitest';

import allNodes from '../../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import { createDropTargetCache, dropStops, findDropTarget } from './drop-target.ts';

const doc = allNodes as unknown as DesignDocument;
const target = { kind: 'page' as const, pageId: 'p_home000001' };

describe('findDropTarget pure calculation', () => {
  it('returns undefined if coordinates hit nothing in iframe DOM', () => {
    const fakeDoc = document.implementation.createHTMLDocument();
    const cache = createDropTargetCache();
    const res = findDropTarget(
      fakeDoc,
      doc,
      target,
      100,
      100,
      { kind: 'move', nodeIds: ['n_btn0000001'] },
      new Set(),
      cache,
    );
    expect(res).toBeUndefined();
  });

  it('detects drop target and caches canInsert lookup', () => {
    const rootId = doc.pages['p_home000001']?.root.id ?? 'n_allnode051';
    const fakeDoc = document.implementation.createHTMLDocument();
    fakeDoc.body.innerHTML = `
      <div data-rc-node="${rootId}" data-rc-container="true" style="width: 500px; height: 500px;">
        <div data-rc-node="n_child00001" style="width: 100px; height: 50px;"></div>
      </div>
    `;
    const container = fakeDoc.querySelector(`[data-rc-node="${rootId}"]`) as HTMLElement;
    container.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
      width: 500,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fakeDoc.elementsFromPoint = () => [container];

    const cache = createDropTargetCache();
    const res = findDropTarget(
      fakeDoc,
      doc,
      target,
      50,
      50,
      {
        kind: 'new',
        node: {
          id: 'tmp_1',
          type: 'Button',
          content: { kind: 'button', variant: 'primary', text: 'Btn' },
        },
      },
      new Set(),
      cache,
      () => 'Container',
    );
    expect(res).toBeDefined();
    expect(res?.allowed).toBe(true);
    // Verified that cache has entry for rootId
    expect(cache.canInsertCache.has(rootId)).toBe(true);
  });

  it('skips locked container or node', () => {
    const fakeDoc = document.implementation.createHTMLDocument();
    fakeDoc.body.innerHTML = `
      <div data-rc-node="n_locked0001" data-rc-container="true" data-rc-locked="true" style="width: 500px; height: 500px;">
      </div>
    `;
    const el = fakeDoc.querySelector('[data-rc-node="n_locked0001"]') as HTMLElement;
    fakeDoc.elementsFromPoint = () => [el];
    const cache = createDropTargetCache();
    const res = findDropTarget(
      fakeDoc,
      doc,
      target,
      50,
      50,
      { kind: 'move', nodeIds: ['n_btn0000001'] },
      new Set(),
      cache,
    );
    expect(res).toBeUndefined();
  });

  it('dropStops calculates keyboard navigation targets', () => {
    const fakeDoc = document.implementation.createHTMLDocument();
    fakeDoc.body.innerHTML = `
      <div data-rc-node="n_root000001" data-rc-container="true">
        <div data-rc-node="n_child00001"></div>
      </div>
    `;
    const stops = dropStops(
      fakeDoc,
      doc,
      target,
      { kind: 'move', nodeIds: ['n_btn0000001'] },
      new Set(['n_btn0000001']),
    );
    expect(Array.isArray(stops)).toBe(true);
  });
});
