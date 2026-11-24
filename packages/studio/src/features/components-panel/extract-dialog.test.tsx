// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/http.ts';
import * as projectClient from '../../api/project-client.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import type { InspectorTarget } from '../inspector/types.ts';
import { ExtractDialog } from './extract-dialog.tsx';
import { useComponentsStore } from './use-project-components.ts';

describe('ExtractDialog (Scenario #11) [R-CP-14]', () => {
  const mockTarget: Extract<InspectorTarget, { readonly kind: 'element' }> = {
    kind: 'element',
    ref: { loc: 'src/pages/Home.tsx:12:5', index: 0 },
    locFile: 'src/pages/Home.tsx',
    locLine: 12,
    locCol: 5,
    source: {
      loc: 'src/pages/Home.tsx:12:5',
      tag: 'section',
      fileHash: 'a'.repeat(64),
      className: { kind: 'none' },
      text: { kind: 'static', value: '' },
      attributes: {},
      inLoop: false,
    },
    loading: false,
    warnings: [],
    currentScope: { breakpoint: 'base' },
    writePrefix: '',
    refresh: vi.fn(),
    setInteractionState: vi.fn(),
  };

  beforeAll(async () => {
    await initI18n();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  });

  beforeEach(() => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/components', 'src/views']);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useComponentsStore.getState().setComponents([]);
  });

  it('Scenario 11: typing "Hộp khuyến mãi" suggests HopKhuyenMai.tsx, and E023 shows variable name [R-CP-14]', async () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/components', 'src/views']);
    const extractSpy = vi
      .spyOn(projectClient, 'extractComponent')
      .mockRejectedValue(
        new ApiError(400, 'E023', { reason: 'usesLocalScope' }, { name: 'product' }),
      );

    const onClose = vi.fn();
    const onExtracted = vi.fn();

    render(
      <ExtractDialog open={true} target={mockTarget} onClose={onClose} onExtracted={onExtracted} />,
    );

    const nameInput = screen.getByTestId<HTMLInputElement>('extract-name');
    const fileInput = screen.getByTestId<HTMLInputElement>('extract-file');
    const submitBtn = screen.getByTestId<HTMLButtonElement>('extract-submit');

    expect(submitBtn.disabled).toBe(true);

    // Type Vietnamese name: "Hộp khuyến mãi" -> auto generates "HopKhuyenMai.tsx"
    fireEvent.change(nameInput, { target: { value: 'Hộp khuyến mãi' } });
    expect(fileInput.value).toBe('HopKhuyenMai.tsx');
    expect(submitBtn.disabled).toBe(false);

    // Submit triggers extractComponent call
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(extractSpy).toHaveBeenCalledWith({
        loc: 'src/pages/Home.tsx:12:5',
        tag: 'section',
        name: 'Hộp khuyến mãi',
        dir: 'src/components',
        fileName: 'HopKhuyenMai.tsx',
      });
    });

    // Error box displays the local scope variable name 'product'
    const errorBox = await screen.findByTestId('extract-error');
    expect(errorBox.textContent).toContain('product');
    expect(onClose).not.toHaveBeenCalled();

    // Now test successful extraction
    extractSpy.mockResolvedValueOnce({
      changed: true,
      files: ['src/pages/Home.tsx', 'src/components/PromoBox.tsx'],
      locs: ['src/pages/Home.tsx:12:5'],
    });

    fireEvent.change(nameInput, { target: { value: 'PromoBox' } });
    expect(fileInput.value).toBe('PromoBox.tsx');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onExtracted).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('validates duplicate component names and files [R-CP-14]', () => {
    useComponentsStore.getState().setComponents([
      {
        name: 'ExistingComp',
        file: 'src/components/ExistingComp.tsx',
        kind: 'component',
        usages: 1,
        importStatement: "import { ExistingComp } from '@/components/ExistingComp';",
      },
    ]);

    render(<ExtractDialog open={true} target={mockTarget} onClose={vi.fn()} />);

    const nameInput = screen.getByTestId<HTMLInputElement>('extract-name');
    const submitBtn = screen.getByTestId<HTMLButtonElement>('extract-submit');

    // Duplicate name
    fireEvent.change(nameInput, { target: { value: 'ExistingComp' } });
    expect(submitBtn.disabled).toBe(true);

    // Empty name
    fireEvent.change(nameInput, { target: { value: '   ' } });
    expect(submitBtn.disabled).toBe(true);

    // Valid unique name
    fireEvent.change(nameInput, { target: { value: 'NewComponent' } });
    expect(submitBtn.disabled).toBe(false);
  });

  it('defaults dir to views/components and generates .pug filename on express-pug', () => {
    useProjectStore.setState({
      project: {
        id: 'express001',
        name: 'ExpressPug',
        root: '/projects/express-pug',
        sourceDir: 'src',
        support: {
          supported: true,
          reasons: [],
          framework: 'express-pug',
          viewsDir: 'views',
          versions: {},
          language: 'js',
        },
        needsInstall: false,
        responsiveMode: 'desktop-first',
        frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
        primaryFrameId: 'desktop',
        backends: [],
        trusted: true,
        designDirs: {
          pages: ['src/pages'],
          layouts: ['src/layouts'],
          components: ['src/components'],
          drafts: 'src/drafts',
        },
      },
    });

    render(<ExtractDialog open={true} target={mockTarget} onClose={vi.fn()} />);

    const dirInput = screen.getByTestId<HTMLInputElement>('extract-dir');
    const nameInput = screen.getByTestId<HTMLInputElement>('extract-name');
    const fileInput = screen.getByTestId<HTMLInputElement>('extract-file');
    expect(dirInput.value).toBe('views/components');
    fireEvent.change(nameInput, { target: { value: 'ProductCard' } });
    expect(fileInput.value).toBe('product-card.pug');
  });

  it('clears selection when extractComponent returns empty locs (Pug partial)', async () => {
    useSelectionStore.getState().setSelectedRefs([{ loc: 'views/index.pug:4:3', index: 0 }]);
    vi.spyOn(projectClient, 'extractComponent').mockResolvedValue({
      changed: true,
      files: ['views/index.pug', 'views/components/test-banner.pug'],
      locs: [],
    });

    render(<ExtractDialog open={true} target={mockTarget} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('extract-name'), { target: { value: 'TestBanner' } });
    fireEvent.click(screen.getByTestId('extract-submit'));

    await waitFor(() => {
      expect(useSelectionStore.getState().selectedRefs).toEqual([]);
    });
  });
});
