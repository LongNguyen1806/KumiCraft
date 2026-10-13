import { describe, expect, it } from 'vitest';

import { planMoves } from './dnd-canvas-context.tsx';

describe('planMoves (R-DD-04, R-DD-05)', () => {
  it('moves two siblings to the end of their own parent in order [R-DD-05]', () => {
    const { result } = planMoves(['a', 'b'], ['x', 'a', 'b', 'y'], 2);
    expect(result).toEqual(['x', 'y', 'a', 'b']);
  });

  it('moves two siblings to the front, keeping their order [R-DD-05]', () => {
    expect(planMoves(['b', 'c'], ['a', 'b', 'c'], 0).result).toEqual(['b', 'c', 'a']);
  });

  it('places nodes from another parent before the node at the index', () => {
    const { moves, result } = planMoves(['n1', 'n2'], ['p', 'q'], 1);
    expect(result).toEqual(['p', 'n1', 'n2', 'q']);
    expect(moves).toEqual([
      { id: 'n1', index: 1 },
      { id: 'n2', index: 2 },
    ]);
  });

  it('gives the same list back when dropped where the node already is [R-DD-04]', () => {
    expect(planMoves(['b'], ['a', 'b', 'c'], 1).result).toEqual(['a', 'b', 'c']);
  });

  it('moves one node down past its next sibling', () => {
    expect(planMoves(['b'], ['a', 'b', 'c'], 2).result).toEqual(['a', 'c', 'b']);
  });
});
