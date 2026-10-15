// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { extractElementLabel, scanDomTree } from './dom-scanner.ts';

describe('extractElementLabel', () => {
  it('extracts first class without colon', () => {
    const el = document.createElement('div');
    el.setAttribute('class', 'md:flex flex-col text-sm');
    expect(extractElementLabel(el)).toBe('flex-col');
  });

  it('falls back to direct text content up to 24 characters', () => {
    const el = document.createElement('button');
    el.textContent = 'Submit form to payment processor immediately';
    expect(extractElementLabel(el)).toBe('Submit form to payment p');
  });

  it('returns undefined when no class and no text', () => {
    const el = document.createElement('div');
    expect(extractElementLabel(el)).toBeUndefined();
  });
});

describe('scanDomTree', () => {
  it('builds flat TreeNode[] structure with parent indices from DOM', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-rc-loc="App.tsx:1:1" class="container">
        <header data-rc-loc="Header.tsx:2:3" class="header">
          <h1 data-rc-loc="Header.tsx:3:5">Hello World</h1>
        </header>
        <main>
          <p data-rc-loc="App.tsx:5:7">Paragraph text</p>
        </main>
      </div>
    `;

    const payload = scanDomTree(root);
    expect(payload.nodes).toHaveLength(4);

    const [appNode, headerNode, h1Node, pNode] = payload.nodes;

    expect(appNode?.ref).toEqual({ loc: 'App.tsx:1:1', index: 0 });
    expect(appNode?.tag).toBe('div');
    expect(appNode?.label).toBe('container');
    expect(appNode?.instances).toBe(1);
    expect(appNode?.parent).toBeUndefined();

    expect(headerNode?.ref).toEqual({ loc: 'Header.tsx:2:3', index: 0 });
    expect(headerNode?.tag).toBe('header');
    expect(headerNode?.parent).toBe(0);

    expect(h1Node?.ref).toEqual({ loc: 'Header.tsx:3:5', index: 0 });
    expect(h1Node?.tag).toBe('h1');
    expect(h1Node?.label).toBe('Hello World');
    expect(h1Node?.parent).toBe(1);

    expect(pNode?.ref).toEqual({ loc: 'App.tsx:5:7', index: 0 });
    expect(pNode?.tag).toBe('p');
    expect(pNode?.parent).toBe(0);
  });

  it('handles multiple instances of the same loc (V-113: instances count, subtree only for first instance)', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-rc-loc="List.tsx:1:1">
        <li data-rc-loc="Item.tsx:1:1" class="item">
          <span data-rc-loc="Item.tsx:2:3">Item 1</span>
        </li>
        <li data-rc-loc="Item.tsx:1:1" class="item">
          <span data-rc-loc="Item.tsx:2:3">Item 2</span>
        </li>
        <li data-rc-loc="Item.tsx:1:1" class="item">
          <span data-rc-loc="Item.tsx:2:3">Item 3</span>
        </li>
      </div>
    `;

    const payload = scanDomTree(root);
    // listNode (0)
    // item 0 (1, parent 0) -> span 0 (2, parent 1)
    // item 1 (3, parent 0) [subtree skipped per V-113]
    // item 2 (4, parent 0) [subtree skipped per V-113]
    expect(payload.nodes).toHaveLength(5);

    const listNode = payload.nodes[0];
    expect(listNode?.ref).toEqual({ loc: 'List.tsx:1:1', index: 0 });

    const item0 = payload.nodes[1];
    expect(item0?.ref).toEqual({ loc: 'Item.tsx:1:1', index: 0 });
    expect(item0?.instances).toBe(3);
    expect(item0?.parent).toBe(0);

    const span0 = payload.nodes[2];
    expect(span0?.ref).toEqual({ loc: 'Item.tsx:2:3', index: 0 });
    expect(span0?.parent).toBe(1);

    const item1 = payload.nodes[3];
    expect(item1?.ref).toEqual({ loc: 'Item.tsx:1:1', index: 1 });
    expect(item1?.instances).toBe(3);
    expect(item1?.parent).toBe(0);

    const item2 = payload.nodes[4];
    expect(item2?.ref).toEqual({ loc: 'Item.tsx:1:1', index: 2 });
    expect(item2?.instances).toBe(3);
    expect(item2?.parent).toBe(0);
  });
});
