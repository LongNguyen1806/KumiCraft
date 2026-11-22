// A new draft is written in the project's own styling (spec-log #130): Tailwind classes in a
// plain-CSS project (MarketLink) gave a root 0 px high, with nowhere to drop and nothing to select.
import type { StylingReport } from '@kumicraft/shared';
import { describe, expect, it } from 'vitest';

import { extractExportedComponentInfo } from './draft-helpers.ts';
import { buildDraftContent } from './drafts.ts';

const report = (systems: StylingReport['systems']): StylingReport => ({
  systems,
  editable: true,
  globalCss: [],
});

describe('buildDraftContent [R-DR-10] (spec-log #130)', () => {
  it('Tailwind (and an unknown project) keeps the Tailwind root', () => {
    expect(buildDraftContent('A', false, report([{ id: 'tailwind', version: '4' }]))).toContain(
      'className="min-h-screen bg-white p-8"',
    );
    expect(buildDraftContent('A', false, undefined)).toContain('min-h-screen');
  });

  it('Bootstrap gets its own utilities', () => {
    const code = buildDraftContent('A', false, report([{ id: 'bootstrap' }]));
    expect(code).toContain('className="min-vh-100 bg-white p-4"');
    expect(code).not.toContain('min-h-screen');
  });

  it.each(['css', 'cssModules', 'sass'] as const)(
    'plain %s gets an inline size that needs no stylesheet, and no Tailwind class',
    (id) => {
      const code = buildDraftContent('BanNhap1', false, report([{ id }]));
      expect(code).toContain("style={{ minHeight: '100vh', background: '#fff', padding: 32 }}");
      expect(code).not.toContain('className');
      expect(extractExportedComponentInfo(code)).toMatchObject({ name: 'BanNhap1', free: false });
    },
  );

  it('a free draft in plain CSS is positioned and still read as free', () => {
    const code = buildDraftContent('Mockup', true, report([{ id: 'css' }]));
    expect(code).toContain("position: 'relative'");
    expect(extractExportedComponentInfo(code)).toMatchObject({ name: 'Mockup', free: true });
  });
});
