import { afterEach, describe, expect, it } from 'vitest';

import { syncIframeHead } from './canvas-iframe.tsx';

function makeIframeDocument(): Document {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? undefined;
  if (doc === undefined) throw new Error('the iframe has no document');
  return doc;
}

describe('Canvas iframe head (R-CV-07)', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('keeps one theme block and updates it when the tokens change [R-CV-07]', () => {
    const doc = makeIframeDocument();

    syncIframeHead(doc, '@theme { --color-surface: #ffffff; }');
    syncIframeHead(doc, '@theme { --color-surface: #ff0000; }');
    syncIframeHead(doc, '@theme { --color-surface: #ff0000; }');

    const themes = doc.querySelectorAll('style#rc-theme');
    expect(themes).toHaveLength(1);
    expect(themes[0]?.textContent).toBe('@theme { --color-surface: #ff0000; }');
    expect(themes[0]?.getAttribute('type')).toBe('text/tailwindcss');
  });

  it('adds the Tailwind runtime and the helper styles once', () => {
    const doc = makeIframeDocument();

    syncIframeHead(doc, '');
    syncIframeHead(doc, '@theme { --color-a: red; }');

    expect(doc.querySelectorAll('script#rc-tw-runtime')).toHaveLength(1);
    expect(doc.querySelectorAll('style#rc-helpers')).toHaveLength(1);
  });
});
