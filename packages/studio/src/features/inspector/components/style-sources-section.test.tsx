// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../../i18n/i18n.ts';
import { useStyleState } from '../../style/style-reading.ts';
import { CssStyleEditor, StyleSourcesSection } from './style-sources-section.tsx';

vi.mock('../../style/style-reading.ts', () => ({
  useStyleState: vi.fn(),
}));

describe('StyleSourcesSection [R-ST-04, R-ST-05]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
  });

  it('lists properties with file:line and the shared count; an inherited one shows no source', () => {
    render(
      <StyleSourcesSection
        reading={{
          primary: 'css',
          properties: [
            {
              id: 'paddingTop',
              value: { css: '16px' },
              source: {
                kind: 'rule',
                system: 'css',
                file: 'src/components/Card.css',
                line: 2,
                selector: '.card',
                affects: 3,
              },
              editable: true,
            },
            {
              id: 'textColor',
              value: { css: 'rgb(0, 0, 0)' },
              source: { kind: 'inherited' },
              editable: true,
            },
          ],
        }}
      />,
    );

    const row = screen.getByTestId('style-source-paddingTop');
    expect(row.textContent).toContain('padding-top');
    expect(row.textContent).toContain('src/components/Card.css:2');
    expect(screen.getByTestId('style-affects-paddingTop').textContent).toBe('Affects 3 elements');
    expect(screen.getByTestId('style-source-textColor').textContent).not.toContain('.css');
    expect(screen.getByTestId<HTMLInputElement>('style-input-paddingTop').disabled).toBe(true);
  });

  it('when writable, commits a changed value on Enter and offers "all N / only this element" for a shared rule [R-ST-06, R-ST-07]', () => {
    const onCommit = vi.fn();
    const onTargetChange = vi.fn();
    render(
      <StyleSourcesSection
        writable
        target="rule"
        onCommit={onCommit}
        onTargetChange={onTargetChange}
        reading={{
          primary: 'css',
          properties: [
            {
              id: 'paddingTop',
              value: { css: '16px' },
              source: {
                kind: 'rule',
                system: 'css',
                file: 'src/Card.css',
                line: 2,
                selector: '.card',
                affects: 3,
              },
              editable: true,
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId<HTMLInputElement>('style-target-rule').checked).toBe(true);
    fireEvent.click(screen.getByTestId('style-target-element'));
    expect(onTargetChange).toHaveBeenCalledWith('element');

    const input = screen.getByTestId('style-input-paddingTop');
    fireEvent.change(input, { target: { value: '24px' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('paddingTop', '24px');
  });

  it('enables inputs and hides unsupported banner when primary: "cssModules" [R-ST-02]', () => {
    vi.mocked(useStyleState).mockReturnValue({
      state: {
        probe: {
          ref: { loc: 'src/Card.tsx:4:5', index: 0 },
          found: true,
          rules: [],
          inline: [],
          computed: {},
        },
        reading: {
          primary: 'cssModules',
          properties: [
            {
              id: 'paddingTop',
              value: { css: '16px' },
              source: {
                kind: 'rule',
                system: 'cssModules',
                file: 'src/components/Card.module.css',
                line: 2,
                selector: '.card',
                affects: 1,
              },
              editable: true,
            },
          ],
        },
      },
      refresh: vi.fn(),
    });

    render(
      <CssStyleEditor
        target={{
          kind: 'element',
          ref: { loc: 'src/Card.tsx:4:5', index: 0 },
          loading: false,
          warnings: [],
          currentScope: { breakpoint: 'base' },
          writePrefix: '',
          setInteractionState: vi.fn(),
          refresh: vi.fn(),
        }}
      />,
    );

    expect(screen.queryByTestId('inspector-style-unsupported')).toBeNull();
    const input = screen.getByTestId<HTMLInputElement>('style-input-paddingTop');
    expect(input.disabled).toBe(false);
  });
});
