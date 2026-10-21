// Unit test for safe Markdown rendering in AI chat (WP-3.05a, Situation 10, S-14, S-15, S-114).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatMarkdown } from './chat-markdown.tsx';

describe('ChatMarkdown safety [S-14, S-15, S-114]', () => {
  it('renders strong tags, removes img and script, strips javascript links, and allows https [S-14, S-15, S-114]', () => {
    const raw =
      '**đậm** <img src=x onerror="alert(1)"> <script>alert(1)</script> [xấu](javascript:alert(1)) [tốt](https://example.com)';
    const { container } = render(<ChatMarkdown text={raw} />);

    // Has strong tag
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('đậm');

    // No img or script in DOM
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();

    // "xấu" is text, not an anchor tag
    const anchors = Array.from(container.querySelectorAll('a'));
    const badAnchor = anchors.find((a) => a.textContent.includes('xấu'));
    expect(badAnchor).toBeUndefined();
    expect(container.textContent).toContain('xấu');

    // "tốt" is an anchor with target="_blank" and rel="noreferrer"
    const goodAnchor = anchors.find((a) => a.textContent.includes('tốt'));
    expect(goodAnchor).toBeDefined();
    expect(goodAnchor?.getAttribute('href')).toBe('https://example.com');
    expect(goodAnchor?.getAttribute('target')).toBe('_blank');
    expect(goodAnchor?.getAttribute('rel')).toBe('noreferrer');
  });
});
