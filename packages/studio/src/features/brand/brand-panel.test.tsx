// @vitest-environment happy-dom
import type { ThemeInfo } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClientModule from '../../api/events-client.ts';
import * as filesClient from '../../api/files-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { useHistoryStore } from '../../core/history-store.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { BrandPanel } from './brand-panel.tsx';

const MOCK_THEME: ThemeInfo = {
  file: 'src/index.css',
  colors: [{ name: 'brand', value: '#2563eb' }],
  fonts: [{ name: 'display', value: '"Inter", sans-serif' }],
  fontSizes: [{ name: 'hero', value: '3rem' }],
  radii: [{ name: 'card', value: '0.75rem' }],
  shadows: [{ name: 'card', value: '0 4px 12px rgb(0 0 0 / 0.08)' }],
  breakpoints: [],
};

describe('BrandPanel (Scenarios #13, #14, #15) [R-TH-10, R-TH-11, R-TH-12, R-TH-13]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.spyOn(eventsClientModule, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(MOCK_THEME);
    vi.spyOn(useHistoryStore.getState(), 'load').mockResolvedValue(undefined);
    useThemeStore.setState({ theme: MOCK_THEME });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('#13: renders 5 token groups and commits modified token value on Enter [R-TH-10, R-TH-11]', async () => {
    const updatedTheme: ThemeInfo = {
      ...MOCK_THEME,
      colors: [{ name: 'brand', value: '#1d4ed8' }],
    };
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue(updatedTheme);

    render(<BrandPanel />);

    expect(screen.getByTestId('brand-group-color')).toBeDefined();
    expect(screen.getByTestId('brand-group-font')).toBeDefined();
    expect(screen.getByTestId('brand-group-fontSize')).toBeDefined();
    expect(screen.getByTestId('brand-group-radius')).toBeDefined();
    expect(screen.getByTestId('brand-group-shadow')).toBeDefined();

    const inputs = screen.getAllByTestId('brand-value');
    const brandInput = inputs[0];
    if (!brandInput) throw new Error('Missing brand-value input');
    fireEvent.change(brandInput, { target: { value: '#1d4ed8' } });
    fireEvent.keyDown(brandInput, { key: 'Enter' });

    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledWith({
        op: 'set',
        kind: 'color',
        name: 'brand',
        value: '#1d4ed8',
      });
    });
    expect(useThemeStore.getState().theme.colors[0]?.value).toBe('#1d4ed8');
  });

  it('#14: validates token name before adding and calls editTheme on valid input [R-TH-12]', async () => {
    const updatedTheme: ThemeInfo = {
      ...MOCK_THEME,
      colors: [
        { name: 'brand', value: '#2563eb' },
        { name: 'accent', value: '#f59e0b' },
      ],
    };
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue(updatedTheme);

    render(<BrandPanel />);

    fireEvent.click(screen.getByTestId('brand-add-color'));
    const nameInput = screen.getByTestId('brand-new-name');
    const valInput = screen.getByTestId('brand-new-value');
    const saveBtn = screen.getByTestId('brand-new-save');

    fireEvent.change(nameInput, { target: { value: 'Bad_Name' } });
    fireEvent.change(valInput, { target: { value: '#f59e0b' } });
    fireEvent.click(saveBtn);

    expect(screen.getByTestId('brand-error')).toBeDefined();
    expect(editSpy).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: 'accent' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledWith({
        op: 'add',
        kind: 'color',
        name: 'accent',
        value: '#f59e0b',
      });
    });
  });

  it('#15: removes immediately when usage is 0, and requires confirmation when usage > 0 [R-TH-13]', async () => {
    const editSpy = vi.spyOn(projectClient, 'editTheme').mockResolvedValue({
      ...MOCK_THEME,
      colors: [],
    });
    const usageSpy = vi
      .spyOn(projectClient, 'fetchThemeUsage')
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 4 });

    render(<BrandPanel />);

    const removeButtons = screen.getAllByTestId('brand-remove');
    const firstRemove = removeButtons[0];
    if (!firstRemove) throw new Error('Missing brand-remove button');
    fireEvent.click(firstRemove);

    await waitFor(() => {
      expect(usageSpy).toHaveBeenCalledWith('color', 'brand');
      expect(editSpy).toHaveBeenCalledWith({ op: 'remove', kind: 'color', name: 'brand' });
    });

    editSpy.mockClear();
    act(() => {
      useThemeStore.setState({ theme: MOCK_THEME });
    });

    const removeButtonsAgain = screen.getAllByTestId('brand-remove');
    const secondRemove = removeButtonsAgain[0];
    if (!secondRemove) throw new Error('Missing brand-remove button');
    fireEvent.click(secondRemove);

    await waitFor(() => {
      expect(screen.getByTestId('brand-confirm-delete')).toBeDefined();
    });
    expect(editSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('brand-confirm-delete'));
    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledWith({ op: 'remove', kind: 'color', name: 'brand' });
    });
  });

  it('system: "bootstrap5", token primary inherited → có nhãn mặc định, không có nút xóa, hiện variable [R-ST-11]', () => {
    const bootstrapTheme: ThemeInfo = {
      file: 'src/index.css',
      system: 'bootstrap5',
      colors: [
        {
          name: 'primary',
          value: '#0d6efd',
          variable: '--bs-primary',
          inherited: true,
        },
      ],
      fonts: [],
      fontSizes: [],
      radii: [],
      shadows: [],
      breakpoints: [],
    };
    useThemeStore.setState({ theme: bootstrapTheme });

    render(<BrandPanel />);

    expect(screen.getByTestId('brand-system-name').textContent).toContain('Bootstrap 5');
    expect(screen.getByTestId('brand-file-path').textContent).toContain('src/index.css');
    expect(screen.getByTestId('brand-token-variable').textContent).toBe('--bs-primary');
    expect(screen.getByTestId('brand-inherited')).toBeDefined();
    expect(screen.queryByTestId('brand-remove')).toBeNull();
  });

  it('[WP-4.00] test 20: studio Brand test: Brand hiện tên file token; "Đổi file…" chọn file → PATCH /project styleFiles.tokenFile; "Tự động" → bỏ tokenFile', async () => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };

    const initialTheme: ThemeInfo = {
      ...MOCK_THEME,
      system: 'css',
      file: 'src/theme.css',
    };
    vi.spyOn(projectClient, 'fetchProjectTheme').mockResolvedValue(initialTheme);
    useThemeStore.setState({ theme: initialTheme });

    useProjectStore.getState().setProject({
      id: 'test-proj',
      name: 'Test Project',
      root: 'D:/test',
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        language: 'ts',
        versions: {},
        styling: {
          systems: [{ id: 'css' }],
          editable: true,
          primary: 'css',
          globalCss: ['src/theme.css'],
        },
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [],
      primaryFrameId: 'main',
      backends: [],
      trusted: true,
      designDirs: {
        pages: ['src/pages'],
        layouts: ['src/layouts'],
        components: ['src/components'],
        drafts: 'src/drafts',
      },
    });

    vi.spyOn(filesClient, 'fetchFileTree').mockResolvedValue({
      dir: '',
      entries: [
        { name: 'src', path: 'src', kind: 'directory', hidden: false },
        { name: 'other.css', path: 'src/other.css', kind: 'file', hidden: false },
      ],
      truncated: false,
    });

    const patchSpy = vi.spyOn(projectClient, 'patchProject').mockResolvedValue({
      id: 'test-proj',
      name: 'Test Project',
      root: 'D:/test',
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        language: 'ts',
        versions: {},
        styling: { systems: [{ id: 'css' }], editable: true, primary: 'css', globalCss: [] },
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [],
      primaryFrameId: 'main',
      backends: [],
      trusted: true,
      designDirs: {
        pages: ['src/pages'],
        layouts: ['src/layouts'],
        components: ['src/components'],
        drafts: 'src/drafts',
      },
      styleFiles: { tokenFile: 'src/other.css' },
    });

    const { rerender } = render(<BrandPanel />);

    // Brand shows current file
    expect(screen.getByTestId('brand-file-path').textContent).toContain('src/theme.css');

    // Click "Đổi file…"
    fireEvent.click(screen.getByTestId('brand-change-file'));

    await waitFor(() => {
      expect(screen.getByTestId('picker-item-src/other.css')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('picker-item-src/other.css'));
    fireEvent.click(screen.getByTestId('folder-picker-confirm'));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
    });
    const firstCall = patchSpy.mock.calls[0]?.[0];
    expect(firstCall?.styleFiles?.tokenFile).toBe('src/other.css');

    // Update store to simulate server response with custom tokenFile
    const curProj = useProjectStore.getState().project;
    if (curProj) {
      useProjectStore.getState().setProject({
        ...curProj,
        styleFiles: { tokenFile: 'src/other.css' },
      });
    }
    rerender(<BrandPanel />);

    // "Tự động" button should now be visible
    const autoBtn = screen.getByTestId('brand-auto-file');
    expect(autoBtn).toBeDefined();

    fireEvent.click(autoBtn);
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledTimes(2);
    });
    const secondCall = patchSpy.mock.calls[1]?.[0];
    expect(secondCall?.styleFiles?.tokenFile).toBeUndefined();
  });
});
