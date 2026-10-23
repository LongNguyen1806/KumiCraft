// Tests for buildPrompt (WP-3.03b, R-AG-13, S-117).
import { describe, expect, it } from 'vitest';

import { buildPrompt } from './prompt.ts';

describe('buildPrompt [R-AG-13, S-117]', () => {
  it('[R-AG-13, S-117] 1. buildPrompt builds formatted text, truncates guide at 8000, and rejects prompts exceeding 30000 chars', () => {
    const fullRes = buildPrompt({
      request: 'Add button',
      context: {
        element: { loc: 'src/App.tsx:10:4', tag: 'button' },
        route: '/home',
        frame: { id: 'desktop', width: 1440 },
      },
      mirrors: [
        { label: 'api', dir: '/cache/m1' },
        { label: 'worker', dir: '/cache/m2' },
      ],
      docs: ['docs/spec.md'],
      guide: 'g'.repeat(9000),
    });
    expect(fullRes.ok).toBe(true);
    if (fullRes.ok) {
      expect(fullRes.value).toContain('Add button');
      expect(fullRes.value).toContain('Selected element: src/App.tsx:10:4 (button)');
      expect(fullRes.value).toContain('Page: /home');
      expect(fullRes.value).toContain('Viewport: desktop, 1440 px');
      expect(fullRes.value).toContain('- api: /cache/m1');
      expect(fullRes.value).toContain('- worker: /cache/m2');
      expect(fullRes.value).toContain('- docs/spec.md');
      expect(fullRes.value).toContain('g'.repeat(8000));
      expect(fullRes.value).not.toContain('g'.repeat(8001));
    }

    const minimalRes = buildPrompt({
      request: 'Fix layout',
      context: {},
      mirrors: [],
      docs: [],
    });
    expect(minimalRes.ok).toBe(true);
    if (minimalRes.ok) {
      expect(minimalRes.value).toBe('Fix layout');
    }

    const longRes = buildPrompt({
      request: 'r'.repeat(29000),
      context: {},
      mirrors: [],
      docs: [],
      guide: 'g'.repeat(2000),
    });
    expect(longRes.ok).toBe(false);
    if (!longRes.ok) {
      expect(longRes.error.code).toBe('E016');
      expect(longRes.error.params?.['reason']).toBe('promptTooLong');
    }

    const imageRes = buildPrompt({
      request: 'Clone this UI',
      context: {},
      mirrors: [],
      docs: [],
      images: ['/cache/chat-images/p1/img01.png', '/cache/chat-images/p1/img02.png'],
    });
    expect(imageRes.ok).toBe(true);
    if (imageRes.ok) {
      expect(imageRes.value).toContain(
        'Images the user attached (read them with your file tools):',
      );
      expect(imageRes.value).toContain('- /cache/chat-images/p1/img01.png');
      expect(imageRes.value).toContain('- /cache/chat-images/p1/img02.png');
    }
  });
});
