// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { collectSelectionInfo, MAX_DOM_CLASS } from './selection-info.ts';

describe('collectSelectionInfo [R-BR-16]', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('collects found element with instances, tag, rect and domClass [R-BR-16]', () => {
    document.body.innerHTML = `
      <div data-rc-loc="src/App.tsx:1:1" class="first">First</div>
      <div data-rc-loc="src/App.tsx:1:1" class="second flex p-4">Second</div>
      <div data-rc-loc="src/App.tsx:1:1" class="third">Third</div>
    `;

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      top: 20,
      bottom: 70,
      left: 10,
      right: 110,
      toJSON: () => {},
    });

    const info = collectSelectionInfo([{ loc: 'src/App.tsx:1:1', index: 1 }], document.body, []);

    expect(info).toEqual([
      {
        ref: { loc: 'src/App.tsx:1:1', index: 1 },
        found: true,
        tag: 'div',
        instances: 3,
        domClass: 'second flex p-4',
        rect: { x: 10, y: 20, width: 100, height: 50 },
        ancestors: [],
      },
    ]);
  });

  it('lists the real ancestors of a repeated copy, nearest first, with their copy index [R-BR-16, R-CP-11]', () => {
    document.body.innerHTML = `
      <main data-rc-loc="src/pages/Home.tsx:5:3">
        <div data-rc-loc="src/pages/Home.tsx:8:5">
          <article data-rc-loc="src/components/ProductCard.tsx:4:3">
            <h3 data-rc-loc="src/components/ProductCard.tsx:5:5">A</h3>
          </article>
          <span><article data-rc-loc="src/components/ProductCard.tsx:4:3">
            <h3 data-rc-loc="src/components/ProductCard.tsx:5:5">B</h3>
          </article></span>
        </div>
      </main>
    `;

    const [info] = collectSelectionInfo(
      [{ loc: 'src/components/ProductCard.tsx:5:5', index: 1 }],
      document.body,
      [],
    );

    expect(info?.ancestors).toEqual([
      { loc: 'src/components/ProductCard.tsx:4:3', index: 1 },
      { loc: 'src/pages/Home.tsx:8:5', index: 0 },
      { loc: 'src/pages/Home.tsx:5:3', index: 0 },
    ]);
  });

  it('returns found false with tag from previous and without rect or domClass when element is missing [R-BR-16]', () => {
    document.body.innerHTML = '';

    const info = collectSelectionInfo([{ loc: 'src/Header.tsx:5:2', index: 0 }], document.body, [
      {
        ref: { loc: 'src/Header.tsx:5:2', index: 0 },
        found: true,
        tag: 'h2',
        instances: 1,
        domClass: 'text-xl',
      },
    ]);

    expect(info).toHaveLength(1);
    expect(info[0]).toEqual({
      ref: { loc: 'src/Header.tsx:5:2', index: 0 },
      found: false,
      tag: 'h2',
      instances: 1,
    });
    expect(info[0]).not.toHaveProperty('rect');
    expect(info[0]).not.toHaveProperty('domClass');
  });

  it('falls back to tag unknown when element is missing and previous is empty [R-BR-16]', () => {
    document.body.innerHTML = '';

    const info = collectSelectionInfo(
      [{ loc: 'src/Missing.tsx:1:1', index: 0 }],
      document.body,
      [],
    );

    expect(info).toEqual([
      {
        ref: { loc: 'src/Missing.tsx:1:1', index: 0 },
        found: false,
        tag: 'unknown',
        instances: 1,
      },
    ]);
  });

  it('returns found false when ref.index exceeds number of instances [R-BR-16]', () => {
    document.body.innerHTML = `
      <span data-rc-loc="src/Card.tsx:2:1">Single instance</span>
    `;

    const info = collectSelectionInfo([{ loc: 'src/Card.tsx:2:1', index: 5 }], document.body, []);

    expect(info).toEqual([
      {
        ref: { loc: 'src/Card.tsx:2:1', index: 5 },
        found: false,
        tag: 'unknown',
        instances: 1,
      },
    ]);
  });

  it('safely finds element when loc contains quotes [R-BR-16]', () => {
    const quoteLoc = 'src/a"b.tsx:1:1';
    const el = document.createElement('div');
    el.setAttribute('data-rc-loc', quoteLoc);
    document.body.appendChild(el);

    expect(() => {
      const info = collectSelectionInfo([{ loc: quoteLoc, index: 0 }], document.body, []);
      expect(info[0]?.found).toBe(true);
    }).not.toThrow();
  });

  it('omits domClass when class attribute is missing, and truncates domClass to MAX_DOM_CLASS [R-BR-16]', () => {
    const longClass = 'a'.repeat(5000);
    document.body.innerHTML = `
      <p data-rc-loc="src/NoClass.tsx:1:1">No class</p>
      <p data-rc-loc="src/LongClass.tsx:1:1" class="${longClass}">Long class</p>
    `;

    const info = collectSelectionInfo(
      [
        { loc: 'src/NoClass.tsx:1:1', index: 0 },
        { loc: 'src/LongClass.tsx:1:1', index: 0 },
      ],
      document.body,
      [],
    );

    expect(info[0]?.found).toBe(true);
    expect(info[0]).not.toHaveProperty('domClass');

    expect(info[1]?.found).toBe(true);
    expect(info[1]?.domClass).toHaveLength(MAX_DOM_CLASS);
    expect(info[1]?.domClass).toBe('a'.repeat(MAX_DOM_CLASS));
  });
});
