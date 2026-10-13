// Unit tests for style-edit pure helpers (WP-1.09 part B).
import type { DesignNode } from '@reactcraft/model';
import { describe, expect, it } from 'vitest';

import { buildClearOverride, buildSetPaddingEdge, buildSetStyleProperty } from './style-edit.ts';

const pad = (n: number) => ({
  top: { px: n },
  right: { px: n },
  bottom: { px: n },
  left: { px: n },
});

describe('style-edit helpers', () => {
  it('buildSetPaddingEdge preserves other edges from effective style', () => {
    const node: DesignNode = {
      id: 'n_01',
      type: 'Card',
      content: { kind: 'none' },
      style: { padding: pad(24) },
    };

    const op = buildSetPaddingEdge(node, 'top', { px: 40 }, 1440, 'desktop-first', {}, 'p_01');

    expect(op).toEqual({
      op: 'setStyle',
      target: { kind: 'page', pageId: 'p_01' },
      nodeId: 'n_01',
      scope: {},
      set: {
        padding: {
          top: { px: 40 },
          right: { px: 24 },
          bottom: { px: 24 },
          left: { px: 24 },
        },
      },
    });
  });

  it('buildSetPaddingEdge at mobile inherits other edges from desktop', () => {
    const node: DesignNode = {
      id: 'n_01',
      type: 'Card',
      content: { kind: 'none' },
      style: { padding: pad(24) },
    };

    const op = buildSetPaddingEdge(
      node,
      'top',
      { px: 8 },
      375,
      'desktop-first',
      { breakpoint: 'sm' },
      'p_01',
    );

    expect(op).toEqual({
      op: 'setStyle',
      target: { kind: 'page', pageId: 'p_01' },
      nodeId: 'n_01',
      scope: { breakpoint: 'sm' },
      set: {
        padding: {
          top: { px: 8 },
          right: { px: 24 },
          bottom: { px: 24 },
          left: { px: 24 },
        },
      },
    });
  });

  it('buildSetStyleProperty sets the target property at the given scope', () => {
    const op = buildSetStyleProperty('n_01', 'opacity', 50, { state: 'hover' }, 'p_01');

    expect(op).toEqual({
      op: 'setStyle',
      target: { kind: 'page', pageId: 'p_01' },
      nodeId: 'n_01',
      scope: { state: 'hover' },
      set: { opacity: 50 },
    });
  });

  it('buildClearOverride unsets the property at the given breakpoint', () => {
    const op = buildClearOverride('n_01', 'padding', 'sm', 'p_01');

    expect(op).toEqual({
      op: 'setStyle',
      target: { kind: 'page', pageId: 'p_01' },
      nodeId: 'n_01',
      scope: { breakpoint: 'sm' },
      set: {},
      unset: ['padding'],
    });
  });

  it('validates setStyle direction row on Stack', () => {
    const op = buildSetStyleProperty('n_dndroot001', 'direction', 'row', {}, 'p_home000001');
    expect(op).toEqual({
      op: 'setStyle',
      target: { kind: 'page', pageId: 'p_home000001' },
      nodeId: 'n_dndroot001',
      scope: {},
      set: { direction: 'row' },
    });
  });
});
