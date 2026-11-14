// @vitest-environment happy-dom
// Tests for K9.8-1 Groups 4 & 7 (Bridge): DarkStatePreview and per-run mixed text editing.
import type { ElementRef } from '@kumicraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DarkStatePreview } from './dark-state-preview.ts';
import { findClickedTextRunIndex, TextEditController } from './text-edit.ts';

describe('Bridge interaction previews & mixed text run editing (K9.8-1 Groups 4 & 7)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('dark');
    document.body.innerHTML = '';
  });

  it('toggles .dark on documentElement without modifying files and cleans up on destroy (Group 4)', () => {
    const preview = new DarkStatePreview();
    preview.setDarkPreview(document, true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const card = document.createElement('div');
    const ref: ElementRef = { loc: 'src/App.tsx:5:5', index: 0 };
    card.setAttribute('data-rc-loc', ref.loc);
    document.body.appendChild(card);

    preview.setStatePreview(document, { ref, state: 'selected' });
    expect(card.getAttribute('data-selected')).toBe('true');

    preview.clearState(document);
    expect(card.hasAttribute('data-selected')).toBe(false);

    preview.destroy(document);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('dispatches loading preview custom event and select-panel preview event', () => {
    const preview = new DarkStatePreview();
    const grp = document.createElement('div');
    const ref: ElementRef = { loc: 'src/App.tsx:10:5', index: 0 };
    grp.setAttribute('data-rc-loc', ref.loc);
    document.body.appendChild(grp);

    let receivedIndex: number | undefined;
    grp.addEventListener('kumicraft:select-preview', (ev) => {
      if (ev instanceof CustomEvent) {
        const detail = ev.detail as { readonly activeIndex?: number };
        receivedIndex = detail.activeIndex;
      }
    });
    preview.setSelectPanelPreview(document, ref, 2);
    expect(receivedIndex).toBe(2);

    let loadingActive: boolean | undefined;
    window.addEventListener('kumicraft:loading-preview', (ev) => {
      if (ev instanceof CustomEvent) {
        const detail = ev.detail as { readonly active?: boolean };
        loadingActive = detail.active;
      }
    });
    preview.setStatePreview(document, { ref, state: 'loading' });
    expect(loadingActive).toBe(true);
    preview.clearState(document);
    expect(loadingActive).toBe(false);
  });

  it('identifies clicked text run index around inline SVG/span children and commits targeted run (Group 7)', () => {
    const h3 = document.createElement('h3');
    const ref: ElementRef = { loc: 'src/Home.tsx:14:7', index: 0 };
    h3.setAttribute('data-rc-loc', ref.loc);

    const text0 = document.createTextNode('Mua ');
    const span = document.createElement('span');
    span.textContent = 'ngay';
    const text1 = document.createTextNode(' Pin & USB-C');
    h3.appendChild(text0);
    h3.appendChild(span);
    h3.appendChild(text1);
    document.body.appendChild(h3);

    // Mock Range client rects per text node to simulate hit testing
    const origCreateRange = document.createRange.bind(document);
    const emptyList = origCreateRange().getClientRects();
    const makeRectList = (rect: DOMRect): DOMRectList => ({
      length: 1,
      item: (index: number) => (index === 0 ? rect : emptyList.item(0)),
      0: rect,
      [Symbol.iterator]: () => [rect][Symbol.iterator](),
    });
    vi.spyOn(document, 'createRange').mockImplementation(() => {
      const range = origCreateRange();
      vi.spyOn(range, 'selectNodeContents').mockImplementation((node) => {
        const rect = node === text0 ? new DOMRect(10, 10, 30, 16) : new DOMRect(90, 10, 80, 16);
        vi.spyOn(range, 'getClientRects').mockReturnValue(makeRectList(rect));
      });
      return range;
    });

    expect(findClickedTextRunIndex(h3, 20, 16)).toBe(0);
    expect(findClickedTextRunIndex(h3, 120, 16)).toBe(1);

    vi.restoreAllMocks();
    const commits: { ref: ElementRef; text: string; runIndex?: number | undefined }[] = [];
    const ctrl = new TextEditController({
      onCommit: (r, text, runIndex) => {
        commits.push({ ref: r, text, runIndex });
      },
      onCancel: () => undefined,
    });

    ctrl.start(h3, ref, 1);
    text1.data = 'Pin 40 giờ';
    ctrl.commit();

    expect(commits).toEqual([{ ref, text: 'Pin 40 giờ', runIndex: 1 }]);
    expect(span.textContent).toBe('ngay');
    ctrl.destroy();
  });
});
