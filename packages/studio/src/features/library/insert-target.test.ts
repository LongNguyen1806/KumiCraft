// Where something added next to the selection goes (tour 02): a box that holds only text gets the
// new block after it, never inside it mixed into its words (`<div>Ô xanh<div>Ô vàng</div></div>`).
import { afterEach, describe, expect, it } from 'vitest';

import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import { determineInsertTarget } from './insert-block.ts';

const REF = { loc: 'src/pages/Home.tsx:12:11', index: 0 };

afterEach(() => {
  useStructureErrorStore.getState().setActiveSource(undefined);
});

describe('determineInsertTarget', () => {
  it('puts a block after a box that holds only text [R-CP-11] (tour 02)', () => {
    useStructureErrorStore.getState().setActiveSource({ loc: REF.loc, tag: 'div', textOnly: true });
    expect(determineInsertTarget(REF, 'div')).toEqual({
      kind: 'sibling',
      ref: { loc: REF.loc, tag: 'div' },
      where: 'after',
    });
  });

  it('still puts a block inside an empty box or one with children [R-CP-11] (tour 02)', () => {
    useStructureErrorStore
      .getState()
      .setActiveSource({ loc: REF.loc, tag: 'div', textOnly: false });
    expect(determineInsertTarget(REF, 'div')).toEqual({
      kind: 'child',
      parent: { loc: REF.loc, tag: 'div' },
      where: 'end',
    });
  });

  it('reads the text flag only for the element it was loaded for [R-CP-11] (tour 02)', () => {
    useStructureErrorStore
      .getState()
      .setActiveSource({ loc: 'src/pages/Home.tsx:99:1', tag: 'div', textOnly: true });
    expect(determineInsertTarget(REF, 'div').kind).toBe('child');
  });
});
