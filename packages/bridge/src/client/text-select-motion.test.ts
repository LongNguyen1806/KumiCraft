// Bridge tests for inline UTF-16 text selection (Test 5) and motion-preview (Test 18, 18b).
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { triggerMotionPreview } from './motion-preview.ts';
import { readSelectionInElement } from './text-select.ts';

describe('Bridge text-select & motion-preview [K9.7-2]', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 5: computes normalized UTF-16 start/end including Vietnamese diacritics', () => {
    const p = document.createElement('p');
    p.textContent = '  Xin chào   Việt Nam  ';
    document.body.appendChild(p);
    const textNode = p.firstChild;
    expect(textNode).toBeTruthy();

    const sel = window.getSelection();
    expect(sel).toBeTruthy();
    const range = document.createRange();
    // Raw indices for "Việt" inside "  Xin chào   Việt Nam  ":
    // "  Xin chào   " = 13 chars; "Việt" = 13..17
    if (textNode && sel) {
      range.setStart(textNode, 13);
      range.setEnd(textNode, 17);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    const res = readSelectionInElement(p);
    // Normalized string: "Xin chào Việt Nam" -> "Xin chào " is 9 chars, "Việt" is 9..13
    expect(res?.start).toBe(9);
    expect(res?.end).toBe(13);
  });

  it('Test 18: motion-preview holds the hover look the CSS gives the element, then gives its style back', () => {
    vi.useFakeTimers();
    const style = document.createElement('style');
    style.textContent = '.lift:hover { opacity: 0.5; } .other:hover { color: red; }';
    document.head.appendChild(style);
    const card = document.createElement('div');
    card.setAttribute('data-rc-loc', 'src/App.tsx:5:5');
    card.className = 'lift';
    document.body.appendChild(card);

    const ran = triggerMotionPreview({ ref: { loc: 'src/App.tsx:5:5', index: 0 } }, document);
    expect(ran).toBe(true);
    vi.advanceTimersByTime(10);
    expect(card.style.opacity).toBe('0.5');
    expect(card.style.color).toBe('');
    vi.advanceTimersByTime(1000);
    expect(card.hasAttribute('style')).toBe(false);
    expect(card.className).toBe('lift');
    style.remove();
  });

  it('Test 18b: an element with no motion plays nothing', () => {
    const plain = document.createElement('p');
    plain.setAttribute('data-rc-loc', 'src/App.tsx:6:5');
    document.body.appendChild(plain);
    expect(triggerMotionPreview({ ref: { loc: 'src/App.tsx:6:5', index: 0 } }, document)).toBe(
      false,
    );
  });
});
