// @vitest-environment happy-dom
// Tests for K9.8-1 Groups 7 & 10 (Studio UI): InteractionSection gating, disabled reasons, vi/en labels, MixedTextEditor.
import type { ElementSource } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../../i18n/i18n.ts';
import { MixedTextEditor } from '../mixed-text-editor.tsx';
import { InteractionSection } from './interaction-section.tsx';

vi.mock('../../../../api/source-client.ts', () => ({
  editSource: vi.fn().mockResolvedValue({ hash: 'h', content: '' }),
  fetchElementSourceByLoc: vi.fn(),
  fetchPageTree: vi.fn().mockResolvedValue({ roots: [] }),
}));

vi.mock('../../../editor/page-select.tsx', () => ({
  usePagesData: () => ({
    pages: [{ path: '/about', component: 'About', dynamic: false }],
    convention: true,
    router: { status: 'react-router-dom', hasRouterPackage: true },
    refresh: () => {},
  }),
}));

function makeSource(tag: string, overrides: Partial<ElementSource> = {}): ElementSource {
  return {
    loc: 'src/Home.tsx:10:7',
    tag,
    fileHash: 'a'.repeat(64),
    className: { kind: 'static', value: 'p-4' },
    text: { kind: 'static', value: 'Sample' },
    attributes: {},
    inLoop: false,
    ...overrides,
  };
}

describe('Studio interaction UI, mixed text editor, contrast strip & vi/en i18n (Groups 7 & 10)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows only applicable interaction controls per tag and dims invalid controls with reason in both vi and en', async () => {
    for (const lang of ['vi', 'en'] as const) {
      await i18next.changeLanguage(lang);
      const { rerender } = render(
        <I18nextProvider i18n={i18next}>
          <InteractionSection
            source={makeSource('button', { inLoop: true })}
            refTarget={{ loc: 'src/Home.tsx:10:7', index: 0 }}
            onDone={() => {}}
          />
        </I18nextProvider>,
      );

      expect(screen.getByTestId('inspector-interaction')).toBeDefined();
      const toastBtn = screen.getByTestId<HTMLButtonElement>('open-toast-config-btn');
      const loadBtn = screen.getByTestId<HTMLButtonElement>('make-loading-button');
      const linkBtn = screen.getByTestId<HTMLButtonElement>('apply-link-target');
      expect(toastBtn.disabled).toBe(true);
      expect(loadBtn.disabled).toBe(true);
      expect(linkBtn.disabled).toBe(true);
      expect(screen.getByTestId('open-toast-config-btn-reason').textContent).toBeTruthy();

      // Anchor <a> gets "only applies to <button>" disabled reason on LoadingButton
      rerender(
        <I18nextProvider i18n={i18next}>
          <InteractionSection
            source={makeSource('a')}
            refTarget={{ loc: 'src/Home.tsx:10:7', index: 0 }}
            onDone={() => {}}
          />
        </I18nextProvider>,
      );
      expect(screen.getByTestId<HTMLButtonElement>('make-loading-button').disabled).toBe(true);
      expect(screen.getByTestId('make-loading-button-reason').textContent).toBeTruthy();
      cleanup();
    }
  });

  it('renders MixedTextEditor run inputs and readonly chips and commits setTextRun edit (Group 7)', async () => {
    await i18next.changeLanguage('vi');
    const sourceClient = await import('../../../../api/source-client.ts');
    const onSaved = vi.fn();

    render(
      <I18nextProvider i18n={i18next}>
        <MixedTextEditor
          source={makeSource('h3', {
            text: {
              kind: 'mixed',
              runs: [
                { kind: 'element', tag: 'svg', iconName: 'battery' },
                { kind: 'text', runIndex: 0, value: 'Pin & Kết nối' },
                { kind: 'expression', code: 'price' },
              ],
            },
          })}
          disabled={false}
          onSaved={onSaved}
        />
      </I18nextProvider>,
    );

    expect(screen.getByTestId('text-run-element-chip').textContent).toContain('battery');
    expect(screen.getByTestId('text-run-expression-chip').textContent).toContain('{price}');

    const input = screen.getByTestId<HTMLInputElement>('text-run-input-0');
    fireEvent.change(input, { target: { value: 'Pin 40 giờ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await vi.waitFor(() => {
      expect(sourceClient.editSource).toHaveBeenCalledWith({
        edit: {
          kind: 'setTextRun',
          loc: 'src/Home.tsx:10:7',
          tag: 'h3',
          index: 0,
          before: 'Pin & Kết nối',
          after: 'Pin 40 giờ',
        },
      });
    });
  });
});
