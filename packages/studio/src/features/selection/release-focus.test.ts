// A click on the Canvas hands the keys to the new selection (tour 02, step 19): a Studio button
// that kept the focus swallowed the arrow keys that nudge an element in a free frame.
import { afterEach, describe, expect, it } from 'vitest';

import { releaseStudioFocus } from './bridge-payload-handlers.ts';

afterEach(() => {
  document.body.replaceChildren();
});

function focused<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el);
  el.focus();
  return el;
}

describe('releaseStudioFocus', () => {
  it('lets a focused button go, so arrows reach the Canvas selection [R-FF-15]', () => {
    focused(document.createElement('button'));
    releaseStudioFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps a field being typed in, so its value is not committed by surprise [R-FF-15]', () => {
    const input = focused(document.createElement('input'));
    releaseStudioFocus();
    expect(document.activeElement).toBe(input);
  });

  it('keeps the Canvas frame when it has the keys [R-FF-15]', () => {
    const frame = focused(document.createElement('iframe'));
    frame.tabIndex = 0;
    frame.focus();
    releaseStudioFocus();
    expect(document.activeElement).toBe(frame);
  });
});
