// Bridge tests for inline UTF-16 text selection (Test 5) and motion-preview (Test 18).
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

  it('Test 18: motion-preview toggles temporary classes and replays animation without mutating DOM attributes long-term', () => {
    vi.useFakeTimers();
    const card = document.createElement('div');
    card.setAttribute('data-rc-loc', 'src/App.tsx:5:5');
    card.className = 'card';
    document.body.appendChild(card);

    const ran = triggerMotionPreview(
      {
        ref: { loc: 'src/App.tsx:5:5', index: 0 },
        className: 'animate-bounce kc-preview',
        durationMs: 400,
      },
      document,
    );
    expect(ran).toBe(true);
    expect(card.classList.contains('animate-bounce')).toBe(true);
    expect(card.classList.contains('card')).toBe(true);

    vi.advanceTimersByTime(450);
    expect(card.classList.contains('animate-bounce')).toBe(false);
    expect(card.classList.contains('card')).toBe(true);
  });
});
