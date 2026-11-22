// @vitest-environment happy-dom
import type { DraftInfo, ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as filesClient from '../../api/files-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { ExtractDialog } from '../components-panel/extract-dialog.tsx';
import { PromoteDraftDialog } from '../drafts/promote-draft-dialog.tsx';
import type { InspectorTarget } from '../inspector/types.ts';
import { AddPageForm } from '../pages/add-page-form.tsx';

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

const mockDraft: DraftInfo = {
  name: 'CardDraft',
  file: 'src/drafts/CardDraft.tsx',
  free: false,
  inUse: false,
};

const mockProject: ProjectInfo = {
  id: 'test-proj',
  name: 'Test Project',
  root: 'D:/test',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    language: 'ts',
    versions: {},
    styling: { systems: [{ id: 'css' }], editable: true, globalCss: [] },
  },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [],
  primaryFrameId: 'main',
  backends: [],
  trusted: true,
  designDirs: {
    pages: ['src/views/pages'],
    layouts: ['src/views/layouts'],
    components: ['src/views/components'],
    drafts: 'src/drafts',
  },
};

describe('Forms with DirInputWithPicker [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages', 'src/components']);
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('[WP-4.00] test 15: studio form test: Thêm trang, Tách component, Đưa nháp: "Chọn…" điền ô thư mục; vẫn gõ tay được', async () => {
    vi.spyOn(filesClient, 'fetchFileTree').mockResolvedValue({
      dir: '',
      entries: [
        { name: 'src', path: 'src', kind: 'directory', hidden: false },
        { name: 'picked-dir', path: 'src/picked-dir', kind: 'directory', hidden: false },
      ],
      truncated: false,
    });

    // 1. AddPageForm
    const { unmount: unmountAddPage } = render(<AddPageForm convention={true} />);
    const pageDirInput = screen.getByTestId<HTMLInputElement>('page-dir');
    const pagePickBtn = screen.getByTestId('page-dir-pick-btn');
    expect(pageDirInput).toBeDefined();
    expect(pagePickBtn).toBeDefined();

    // Type manually
    fireEvent.change(pageDirInput, { target: { value: 'src/custom-pages' } });
    expect(pageDirInput.value).toBe('src/custom-pages');

    // Click "Chọn…"
    fireEvent.click(pagePickBtn);
    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src/picked-dir')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('picker-item-src/picked-dir'));
    fireEvent.click(screen.getByTestId('folder-picker-confirm'));
    expect(pageDirInput.value).toBe('src/picked-dir');
    unmountAddPage();

    // 2. ExtractDialog
    const { unmount: unmountExtract } = render(
      <ExtractDialog open={true} target={mockTarget} onClose={vi.fn()} />,
    );
    const extractDirInput = screen.getByTestId<HTMLInputElement>('extract-dir');
    const extractPickBtn = screen.getByTestId('extract-dir-pick-btn');

    // Type manually
    fireEvent.change(extractDirInput, { target: { value: 'src/custom-comp' } });
    expect(extractDirInput.value).toBe('src/custom-comp');

    // Click "Chọn…"
    fireEvent.click(extractPickBtn);
    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src/picked-dir')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('picker-item-src/picked-dir'));
    fireEvent.click(screen.getByTestId('folder-picker-confirm'));
    expect(extractDirInput.value).toBe('src/picked-dir');
    unmountExtract();

    // 3. PromoteDraftDialog
    render(<PromoteDraftDialog open={true} draft={mockDraft} onClose={vi.fn()} />);
    const promoteDirInput = screen.getByTestId<HTMLInputElement>('page-dir');
    const promotePickBtn = screen.getByTestId('page-dir-pick-btn');

    // Type manually
    fireEvent.change(promoteDirInput, { target: { value: 'src/custom-promote' } });
    expect(promoteDirInput.value).toBe('src/custom-promote');

    // Click "Chọn…"
    fireEvent.click(promotePickBtn);
    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src/picked-dir')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('picker-item-src/picked-dir'));
    fireEvent.click(screen.getByTestId('folder-picker-confirm'));
    expect(promoteDirInput.value).toBe('src/picked-dir');
  });

  it('[WP-4.00] test 16: studio promote-draft-dialog test: Mặc định theo designDirs của dự án (không phải src/pages cứng); đổi loại đích → đổi thư mục mặc định theo loại', () => {
    useProjectStore.getState().setProject(mockProject);

    render(<PromoteDraftDialog open={true} draft={mockDraft} onClose={vi.fn()} />);

    // Default should be mockProject.designDirs.pages[0] = 'src/views/pages'
    const dirInput = screen.getByTestId<HTMLInputElement>('page-dir');
    expect(dirInput.value).toBe('src/views/pages');

    // Switch to component
    const componentRadio = screen.getByTestId('promote-target-component');
    fireEvent.click(componentRadio);
    expect(dirInput.value).toBe('src/views/components');

    // Switch back to page
    const pageRadio = screen.getByTestId('promote-target-page');
    fireEvent.click(pageRadio);
    expect(dirInput.value).toBe('src/views/pages');
  });
});
