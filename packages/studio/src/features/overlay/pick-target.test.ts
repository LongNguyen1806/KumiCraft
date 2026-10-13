import { describe, expect, it } from 'vitest';

import { pickTarget } from './pick-target.ts';

describe('pickTarget selection rules (SPEC-04.1 sections 8.2, 8.3)', () => {
  const chain = ['n_section', 'n_container', 'n_card', 'n_button'];

  it('selects level 1 direct child of root when nothing is selected [R-OV-01]', () => {
    const res = pickTarget({
      chain,
      selected: [],
      modifiers: {},
    });
    expect(res).toEqual({ kind: 'select', id: 'n_section' });
  });

  it('drills down to the next deeper child when ancestor is already selected [R-OV-02]', () => {
    const res1 = pickTarget({
      chain,
      selected: ['n_section'],
      modifiers: {},
    });
    expect(res1).toEqual({ kind: 'select', id: 'n_container' });

    const res2 = pickTarget({
      chain,
      selected: ['n_section', 'n_container'],
      modifiers: {},
    });
    expect(res2).toEqual({ kind: 'select', id: 'n_card' });
  });

  it('stays at deepest node when deepest node is already selected', () => {
    const res = pickTarget({
      chain,
      selected: ['n_button'],
      modifiers: {},
    });
    expect(res).toEqual({ kind: 'select', id: 'n_button' });
  });

  it('selects level 1 child when currently selected node is in a different branch [R-OV-01]', () => {
    const res = pickTarget({
      chain,
      selected: ['n_other_header'],
      modifiers: {},
    });
    expect(res).toEqual({ kind: 'select', id: 'n_section' });
  });

  it('selects deepest node directly with deep modifier (Ctrl/Cmd+Click)', () => {
    const res = pickTarget({
      chain,
      selected: [],
      modifiers: { deep: true },
    });
    expect(res).toEqual({ kind: 'select', id: 'n_button' });
  });

  it('toggles node selection with shift modifier (Shift+Click)', () => {
    const res = pickTarget({
      chain,
      selected: ['n_other_node'],
      modifiers: { shift: true },
    });
    expect(res).toEqual({ kind: 'toggle', id: 'n_section' });
  });

  it('toggles off an already-selected ancestor with shift modifier (Shift+Click bỏ chọn)', () => {
    const res = pickTarget({
      chain,
      selected: ['n_section'],
      modifiers: { shift: true },
    });
    expect(res).toEqual({ kind: 'toggle', id: 'n_section' });
  });

  it('toggles deepest node with shift and deep modifier (Shift+Ctrl/Cmd+Click)', () => {
    const res = pickTarget({
      chain,
      selected: ['n_section'],
      modifiers: { shift: true, deep: true },
    });
    expect(res).toEqual({ kind: 'toggle', id: 'n_button' });
  });

  it('skips locked nodes in the chain and clears if all nodes are locked', () => {
    const lockedNodes = new Set(['n_section', 'n_container']);
    const res = pickTarget({
      chain,
      selected: [],
      modifiers: {},
      isLocked: (id) => lockedNodes.has(id),
    });
    expect(res).toEqual({ kind: 'select', id: 'n_card' });

    const allLocked = pickTarget({
      chain,
      selected: [],
      modifiers: {},
      isLocked: () => true,
    });
    expect(allLocked).toEqual({ kind: 'clear' });
  });

  it('returns clear when chain is empty', () => {
    const res = pickTarget({
      chain: [],
      selected: ['n_section'],
      modifiers: {},
    });
    expect(res).toEqual({ kind: 'clear' });
  });
});
