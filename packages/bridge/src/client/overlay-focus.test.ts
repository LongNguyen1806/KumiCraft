// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { focusPath, focusRoots, resolveFocusElement } from './overlay-focus.ts';

describe('overlay-focus (R-CP-15)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('[R-CP-15] focusRoots returns only top-level roots of designFile, focusPath creates cutouts (#15)', () => {
    // DOM setup:
    // - outerHeader (Header.tsx)
    //   - innerHeader (Header.tsx)
    // - homeBox (Home.tsx)
    document.body.innerHTML = `
      <div id="home" data-rc-loc="src/pages/Home.tsx:1:1">
        <header id="outer-header" data-rc-loc="src/components/Header.tsx:5:3">
          <nav id="inner-header" data-rc-loc="src/components/Header.tsx:10:5">
            <a href="/">Home</a>
          </nav>
        </header>
      </div>
    `;

    const roots = focusRoots(document, 'src/components/Header.tsx');
    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe('outer-header');

    const viewport = { width: 1200, height: 800 };
    const rects = [
      { x: 10, y: 10, width: 100, height: 50 },
      { x: 200, y: 150, width: 300, height: 200 },
    ];
    const d = focusPath(viewport, rects);

    // 1 outer rect + 2 hole rects = 3 rectangles
    const mMatches = d.match(/M\b/g);
    const zMatches = d.match(/Z\b/g);
    expect(mMatches).toHaveLength(3);
    expect(zMatches).toHaveLength(3);
    expect(d).toContain('M 0 0 H 1200 V 800 H 0 Z');
    expect(d).toContain('M 10 10 H 110 V 60 H 10 Z');
    expect(d).toContain('M 200 150 H 500 V 350 H 200 Z');
  });

  it('[R-CP-15] resolveFocusElement ignores elements outside designFile and resolves inside elements (#16)', () => {
    document.body.innerHTML = `
      <div id="home" data-rc-loc="src/pages/Home.tsx:1:1">
        <p id="home-text">Welcome</p>
        <header id="header" data-rc-loc="src/components/Header.tsx:5:3">
          <span id="header-link" data-rc-loc="src/components/Header.tsx:10:5">Menu</span>
          <span id="unannotated-text">Click me</span>
        </header>
      </div>
    `;

    const homeEl = document.getElementById('home') ?? undefined;
    const headerLink = document.getElementById('header-link') ?? undefined;
    const unannotatedText = document.getElementById('unannotated-text') ?? undefined;

    // Outside element when focus=true -> undefined
    const resOutside = resolveFocusElement(homeEl, 'src/components/Header.tsx', true);
    expect(resOutside).toBeUndefined();

    // Inside annotated element -> returns element itself
    const resInside = resolveFocusElement(headerLink, 'src/components/Header.tsx', true);
    expect(resInside).toBe(headerLink);

    // Unannotated descendant of component -> ascends to nearest ancestor with same file
    const resAscend = resolveFocusElement(unannotatedText, 'src/components/Header.tsx', true);
    expect(resAscend?.id).toBe('header');

    // When focus=false -> returns target as-is
    const resNoFocus = resolveFocusElement(homeEl, 'src/components/Header.tsx', false);
    expect(resNoFocus).toBe(homeEl);
  });
});
