import { describe, expect, it } from 'vitest';

import { chainFromElement } from './chain-from-element.ts';

describe('chainFromElement DOM extraction (SPEC-04.1 section 8.2)', () => {
  it('extracts chain from 4-level nested elements and strips root ID', () => {
    document.body.innerHTML = `
      <div data-rc-node="root">
        <section data-rc-node="n_sec">
          <div data-rc-node="n_cont">
            <div data-rc-node="n_card">
              <button data-rc-node="n_btn">
                <span>Click me</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    `;

    const span = document.querySelector('span');
    const chain = chainFromElement(span, 'root');
    expect(chain).toEqual(['n_sec', 'n_cont', 'n_card', 'n_btn']);
  });

  it('works correctly with repeated items in List node', () => {
    document.body.innerHTML = `
      <div data-rc-node="root">
        <div data-rc-node="n_list">
          <div data-rc-repeat="1">
            <p data-rc-node="n_text">Item 1</p>
          </div>
          <div data-rc-repeat="1">
            <p data-rc-node="n_text">Item 2</p>
          </div>
        </div>
      </div>
    `;

    const secondItem = document.querySelectorAll('p')[1];
    const chain = chainFromElement(secondItem, 'root');
    expect(chain).toEqual(['n_list', 'n_text']);
  });

  it('cuts at ComponentInstance for inner nodes and includes slot nodes', () => {
    document.body.innerHTML = `
      <div data-rc-node="root">
        <div data-rc-node="n_instance">
          <div data-rc-inner="1">
            <h2 data-rc-inner="1">Component Title</h2>
            <div data-rc-node="n_slot_child">
              <span>Slot Button</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Click on inner template node (h2)
    const h2 = document.querySelector('h2');
    const innerChain = chainFromElement(h2, 'root');
    expect(innerChain).toEqual(['n_instance']);

    // Click on slot child
    const slotSpan = document.querySelector('span');
    const slotChain = chainFromElement(slotSpan, 'root');
    expect(slotChain).toEqual(['n_instance', 'n_slot_child']);
  });

  it('returns empty array when element has no data-rc-node ancestor', () => {
    document.body.innerHTML = `
      <div><button>Outside</button></div>
    `;
    const btn = document.querySelector('button');
    expect(chainFromElement(btn, 'root')).toEqual([]);
    expect(chainFromElement(undefined, 'root')).toEqual([]);
    expect(chainFromElement({}, 'root')).toEqual([]);
    expect(chainFromElement('not an element', 'root')).toEqual([]);
  });
});
