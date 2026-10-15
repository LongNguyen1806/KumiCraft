// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import {
  computeNextSelected,
  findChainRoot,
  getCandidateChain,
  getRefForElement,
  handleElementClick,
} from './candidate-chain.ts';

function getRequiredElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

describe('candidate-chain', () => {
  it('builds candidate chain from outermost to target', () => {
    document.body.innerHTML = `
      <div id="outer" data-rc-loc="App.tsx:1:1">
        <main id="mid" data-rc-loc="App.tsx:2:1">
          <section id="inner" data-rc-loc="App.tsx:3:1">
            <span id="target" data-rc-loc="App.tsx:4:1">Text</span>
          </section>
        </main>
      </div>
    `;

    const target = getRequiredElement('target');
    const chain = getCandidateChain(target);

    expect(chain.map((el) => el.id)).toEqual(['outer', 'mid', 'inner', 'target']);
  });

  it('identifies chain root as outermost with >= 2 bridge children (R-SL-01)', () => {
    document.body.innerHTML = `
      <div id="single-parent" data-rc-loc="App.tsx:1:1">
        <div id="multi-parent" data-rc-loc="App.tsx:2:1">
          <button id="btn1" data-rc-loc="App.tsx:3:1">Btn 1</button>
          <button id="btn2" data-rc-loc="App.tsx:4:1">Btn 2</button>
        </div>
      </div>
    `;

    const btn1 = getRequiredElement('btn1');
    const chain = getCandidateChain(btn1);

    const root = findChainRoot(chain);
    expect(root?.id).toBe('multi-parent');
  });

  it('falls back to outermost element if no element has >= 2 bridge children', () => {
    document.body.innerHTML = `
      <div id="outer" data-rc-loc="App.tsx:1:1">
        <div id="inner" data-rc-loc="App.tsx:2:1">
          <span id="target" data-rc-loc="App.tsx:3:1">Target</span>
        </div>
      </div>
    `;

    const target = getRequiredElement('target');
    const chain = getCandidateChain(target);
    const root = findChainRoot(chain);
    expect(root?.id).toBe('outer');
  });

  it('handles normal click progression through candidate chain (R-SL-02)', () => {
    document.body.innerHTML = `
      <div id="container" data-rc-loc="App.tsx:1:1">
        <div id="card" data-rc-loc="App.tsx:2:1">
          <span id="title" data-rc-loc="App.tsx:3:1">Card Title</span>
        </div>
        <div id="card2" data-rc-loc="App.tsx:4:1">Card 2</div>
      </div>
    `;

    const title = getRequiredElement('title');
    const chain = getCandidateChain(title);
    const card = getRequiredElement('card');

    // Initial click: selects element after root
    const firstSelect = computeNextSelected(chain, undefined);
    expect(firstSelect?.id).toBe('card');

    // Click again when card is selected: goes deeper to title (case a)
    const secondSelect = computeNextSelected(chain, card);
    expect(secondSelect?.id).toBe('title');

    // Click again when title (deepest) is already selected: retains title (exception)
    const thirdSelect = computeNextSelected(chain, title);
    expect(thirdSelect?.id).toBe('title');

    // When card2 is selected (sibling of card), clicking title: parent of card2 is container (ancestor), so select card (case b)
    const card2 = getRequiredElement('card2');
    const siblingSelect = computeNextSelected(chain, card2);
    expect(siblingSelect?.id).toBe('card');
  });

  it('handles Ctrl/Cmd + click selecting the deepest element (R-SL-03)', () => {
    document.body.innerHTML = `
      <div id="container" data-rc-loc="App.tsx:1:1">
        <div id="card" data-rc-loc="App.tsx:2:1">
          <span id="title" data-rc-loc="App.tsx:3:1">Card Title</span>
        </div>
        <div id="card2" data-rc-loc="App.tsx:4:1">Card 2</div>
      </div>
    `;

    const title = getRequiredElement('title');
    const refs = handleElementClick(title, [], { ctrlKey: true });
    expect(refs).toEqual([{ loc: 'App.tsx:3:1', index: 0 }]);
  });

  it('handles Shift + click toggling elements in selection (R-SL-03)', () => {
    document.body.innerHTML = `
      <div id="container" data-rc-loc="App.tsx:1:1">
        <button id="btn1" data-rc-loc="App.tsx:2:1">Btn 1</button>
        <button id="btn2" data-rc-loc="App.tsx:3:1">Btn 2</button>
      </div>
    `;

    const btn1 = getRequiredElement('btn1');
    const btn2 = getRequiredElement('btn2');

    // Click btn1 normally
    const sel1 = handleElementClick(btn1, [], {});
    expect(sel1).toEqual([{ loc: 'App.tsx:2:1', index: 0 }]);

    // Shift-click btn2 adds it
    const sel2 = handleElementClick(btn2, sel1, { shiftKey: true });
    expect(sel2).toEqual([
      { loc: 'App.tsx:2:1', index: 0 },
      { loc: 'App.tsx:3:1', index: 0 },
    ]);

    // Shift-click btn1 removes it
    const sel3 = handleElementClick(btn1, sel2, { shiftKey: true });
    expect(sel3).toEqual([{ loc: 'App.tsx:3:1', index: 0 }]);
  });

  it('computes index for multi-instance elements', () => {
    document.body.innerHTML = `
      <div data-rc-loc="Item.tsx:1:1" id="item0">0</div>
      <div data-rc-loc="Item.tsx:1:1" id="item1">1</div>
      <div data-rc-loc="Item.tsx:1:1" id="item2">2</div>
    `;

    const item1 = getRequiredElement('item1');
    const ref = getRefForElement(item1);
    expect(ref).toEqual({ loc: 'Item.tsx:1:1', index: 1 });
  });
});
