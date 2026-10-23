// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useDesignStore } from './design-store.ts';
import { SelectInFileHint } from './select-in-file-hint.tsx';
import { selectionAnchor } from './selection-anchor.ts';

const HEADER_TITLE = { loc: 'src/components/Header.tsx:6:7', index: 0 };

describe('selectionAnchor and SelectInFileHint [R-CP-11, R-LB-14]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    useDesignStore.getState().exitComponentMode();
    useDesignStore.getState().setTarget(undefined);
    useSelectionStore.getState().setSelectionInfo([]);
  });

  it('names the layout component of a selection outside the page, and opening it makes the insert land there', () => {
    useDesignStore
      .getState()
      .setTarget({ kind: 'page', name: 'Home', file: 'src/pages/Home.tsx', route: '/' });
    useComponentsStore.getState().setComponents([
      {
        name: 'Header',
        file: 'src/components/Header.tsx',
        kind: 'component',
        usages: 1,
        importStatement: "import { Header } from '@/components/Header';",
      },
    ]);
    useSelectionStore.getState().setSelectionInfo([
      {
        ref: HEADER_TITLE,
        found: true,
        tag: 'a',
        instances: 1,
        ancestors: [
          { loc: 'src/components/Header.tsx:4:5', index: 0 },
          { loc: 'src/layouts/MainLayout.tsx:7:5', index: 0 },
        ],
      },
    ]);

    const result = selectionAnchor(HEADER_TITLE);
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'design.selectInFile',
        params: {
          file: 'src/pages/Home.tsx',
          foreignFile: 'src/components/Header.tsx',
          component: 'Header',
        },
      },
    });
    if (result.ok) return;

    render(<SelectInFileHint info={result.error} />);
    expect(screen.getByTestId('select-in-file-hint').textContent).toContain(
      'Header lives in src/components/Header.tsx',
    );
    fireEvent.click(screen.getByTestId('select-in-file-open'));

    expect(useDesignStore.getState().componentMode?.filePath).toBe('src/components/Header.tsx');
    expect(selectionAnchor(HEADER_TITLE)).toEqual({ ok: true, anchor: HEADER_TITLE });
  });

  it('keeps the short hint without a button when the file is no known component', () => {
    render(
      <SelectInFileHint
        info={{
          code: 'design.selectInFile',
          params: { file: 'src/pages/Home.tsx', foreignFile: 'src/main.tsx' },
        }}
      />,
    );

    expect(screen.getByTestId('select-in-file-hint').textContent).toBe(
      'Select an element in src/pages/Home.tsx',
    );
    expect(screen.queryByTestId('select-in-file-open')).toBeNull();
  });
});
