// @vitest-environment happy-dom
// Test 6: All 76 blocks have previews, and form/table data source picker inserts valid source edits.
import { DEFAULT_DESIGN_DIRS, LIBRARY_BLOCKS, type ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../api/project-client.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import { DataSourcePickerDialog } from './data-source-picker-dialog.tsx';
import { resetThemeLookAttempt } from './insert-block.ts';
import { LibraryPanel } from './library-panel.tsx';
import { hasBlockPreview } from './previews/index.tsx';

function mockTailwindProject(): ProjectInfo {
  return {
    id: 'p-data-test',
    name: 'Test Data App',
    root: '/tmp/test-data-app',
    sourceDir: 'src',
    support: {
      supported: true,
      reasons: [],
      framework: 'vite-react',
      versions: { tailwindcss: '4.0.0' },
      language: 'ts',
      styling: {
        systems: [{ id: 'tailwind' }],
        primary: 'tailwind',
        editable: true,
        globalCss: ['src/index.css'],
      },
    },
    needsInstall: false,
    responsiveMode: 'desktop-first',
    frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
    primaryFrameId: 'desktop',
    backends: [],
    designDirs: DEFAULT_DESIGN_DIRS,
    trusted: true,
  };
}

describe('Data Tools Library Integration (Test 6)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    localStorage.clear();
    resetThemeLookAttempt();
    useThemeStore.setState({
      theme: {
        file: 'src/index.css',
        colors: [],
        fontSizes: [],
        radii: [],
        fonts: [],
        shadows: [],
        breakpoints: [],
      },
    });
    useProjectStore.setState({ project: mockTailwindProject() });
    useSelectionStore.getState().reset();
    useSelectionStore.getState().setTree([
      {
        ref: { loc: 'src/App.tsx:10:5', index: 0 },
        tag: 'section',
        label: 'section',
        instances: 1,
      },
    ]);
    useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:10:5', index: 0 }]);
    useStructureErrorStore.getState().clearError();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('provides SVG sketch previews for every block including the data.* blocks', () => {
    expect(LIBRARY_BLOCKS.filter((b) => b.category === 'data')).toHaveLength(7);
    for (const block of LIBRARY_BLOCKS) {
      expect(hasBlockPreview(block.id)).toBe(true);
    }
  });

  it('opens DataSourcePickerDialog from LibraryPanel and generates a form from selected fields', async () => {
    const sourceItem = {
      id: 'ts:src/types/user.ts:UserInput',
      kind: 'typescript' as const,
      label: 'UserInput',
      name: 'UserInput',
      file: 'src/types/user.ts',
    };
    vi.spyOn(projectClient, 'fetchDataSources').mockResolvedValue({
      sources: [sourceItem],
      yamlUnsupportedFiles: [],
    });
    vi.spyOn(projectClient, 'fetchDataSourceFields').mockResolvedValue({
      source: sourceItem,
      fields: [
        { name: 'fullName', label: 'Full Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'secretNote', label: 'Secret Note', type: 'text', required: false },
      ],
    });
    const structSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      locs: ['src/App.tsx:12:7'],
      files: ['src/App.tsx'],
    });

    render(<LibraryPanel />);
    const formBtn = screen.getByTestId('library-add-data.form-from-source');
    fireEvent.click(formBtn);

    await waitFor(() => {
      expect(screen.getByTestId('data-source-picker')).toBeDefined();
      expect(screen.getByTestId('data-field-toggle-fullName')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('data-field-toggle-secretNote'));
    fireEvent.click(screen.getByTestId('data-source-confirm'));

    await waitFor(() => {
      expect(structSpy).toHaveBeenCalledTimes(1);
    });
    const req = structSpy.mock.calls[0]?.[0];
    expect(req?.kind).toBe('insert');
    if (req?.kind === 'insert') {
      expect(req.jsx).toContain('<form');
      expect(req.jsx).toContain('htmlFor="field-fullName"');
      expect(req.jsx).toContain('type="email"');
      expect(req.jsx).not.toContain('field-secretNote');
    }
  });

  it('generates DataTable kit + sample dataArray in table mode', async () => {
    const openApiSource = {
      id: 'openapi:openapi.json:Product',
      kind: 'openapi' as const,
      label: 'Product',
      name: 'Product',
      file: 'openapi.json',
    };
    vi.spyOn(projectClient, 'fetchDataSources').mockResolvedValue({
      sources: [openApiSource],
      yamlUnsupportedFiles: [],
    });
    vi.spyOn(projectClient, 'fetchDataSourceFields').mockResolvedValue({
      source: openApiSource,
      fields: [
        { name: 'title', label: 'Title', type: 'text', required: true },
        { name: 'price', label: 'Price', type: 'number', required: true },
      ],
    });
    const structSpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      locs: ['src/App.tsx:15:7'],
      files: ['src/App.tsx', 'src/kumicraft/data/product.data.ts'],
    });

    render(<DataSourcePickerDialog open={true} mode="table" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('data-field-toggle-title')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('data-source-confirm'));

    await waitFor(() => {
      expect(structSpy).toHaveBeenCalledTimes(1);
    });
    const req = structSpy.mock.calls[0]?.[0];
    expect(req?.kind).toBe('insert');
    if (req?.kind === 'insert') {
      expect(req.jsx).toContain('<DataTable');
      expect(req.kit?.components).toEqual(['DataTable']);
      expect(req.dataArray?.exportName).toBe('productData');
      expect(req.dataArray?.file).toBe('src/kumicraft/data/product.data.ts');
      expect(req.from?.imports.some((imp) => imp.includes('productData'))).toBe(true);
    }
  });
});
