import { describe, expect, it } from 'vitest';

import { bridgeHeadHtml } from './head-html.ts';

describe('[WP-4.00] A8: bridgeHeadHtml', () => {
  it('[WP-4.00] A8: bridgeHeadHtml escapes </script> in JSON; adds nonce when cspNonce is present', () => {
    const maliciousRoot = 'D:/app</script><script>alert(1)</script>';
    const htmlWithoutCsp = bridgeHeadHtml({
      nonce: 'n123',
      studioOrigin: 'http://127.0.0.1:4173',
      rootDir: maliciousRoot,
    });

    expect(htmlWithoutCsp).toContain('id="__rc_bridge"');
    expect(htmlWithoutCsp).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
    // The only closing script tags should be the actual tag closings, not inside JSON content
    const closingTagsCount = (htmlWithoutCsp.match(/<\/script>/g) ?? []).length;
    expect(closingTagsCount).toBe(2);

    const htmlWithCsp = bridgeHeadHtml({
      nonce: 'n123',
      studioOrigin: 'http://127.0.0.1:4173',
      rootDir: 'D:/app',
      cspNonce: 'test-nonce-456',
    });

    expect(htmlWithCsp).toContain('id="__rc_bridge" nonce="test-nonce-456"');
    expect(htmlWithCsp).toContain('src="/@kumicraft/bridge-client.js" nonce="test-nonce-456"');
  });
});
