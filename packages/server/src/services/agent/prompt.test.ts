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

  it('[R-AG-13] 2. prompt with CSS, with Tailwind, and without styling (Situation #10)', () => {
    const cssRes = buildPrompt({
      request: 'Change color',
      context: {},
      mirrors: [],
      docs: [],
      styling: {
        systems: [{ id: 'css' }],
        primary: 'css',
        editable: false,
        globalCss: ['src/index.css'],
      },
    });
    expect(cssRes.ok).toBe(true);
    if (cssRes.ok) {
      expect(cssRes.value).toContain(
        "Styling: plain CSS. Keep using the project's styling approach; do not add Tailwind.",
      );
    }

    const twRes = buildPrompt({
      request: 'Change color',
      context: {},
      mirrors: [],
      docs: [],
      styling: {
        systems: [{ id: 'tailwind', version: '4.0.0' }],
        primary: 'tailwind',
        editable: true,
        globalCss: ['src/index.css'],
      },
    });
    expect(twRes.ok).toBe(true);
    if (twRes.ok) {
      expect(twRes.value).toContain(
        "Styling: Tailwind 4.0.0. Keep using the project's styling approach.",
      );
      expect(twRes.value).not.toContain('do not add Tailwind');
    }

    const legacyRes = buildPrompt({
      request: 'Change color',
      context: {},
      mirrors: [],
      docs: [],
    });
    expect(legacyRes.ok).toBe(true);
    if (legacyRes.ok) {
      expect(legacyRes.value).not.toContain('Styling:');
    }
  });

  it('E2 [WP-4.00]: buildPrompt includes read-only instruction when allowEdits is false and omits it when true', () => {
    const readOnlyRes = buildPrompt({
      request: 'Please update App.tsx',
      context: {},
      mirrors: [],
      docs: [],
      allowEdits: false,
    });
    expect(readOnlyRes.ok).toBe(true);
    if (readOnlyRes.ok) {
      expect(readOnlyRes.value).toContain('chế độ chỉ đọc');
      expect(readOnlyRes.value).toContain('AI được sửa file');
    }

    const editableRes = buildPrompt({
      request: 'Please update App.tsx',
      context: {},
      mirrors: [],
      docs: [],
      allowEdits: true,
    });
    expect(editableRes.ok).toBe(true);
    if (editableRes.ok) {
      expect(editableRes.value).not.toContain('chế độ chỉ đọc');
    }
  });
});
