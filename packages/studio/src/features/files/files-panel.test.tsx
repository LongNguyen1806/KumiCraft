import type { PageInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as editorClient from '../../api/editor-client.ts';
import * as filesClient from '../../api/files-client.ts';
import { ApiError } from '../../api/http.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useCanvasErrorStore } from '../canvas-errors/canvas-error-store.ts';
import { useDesignStore } from '../design/design-store.ts';
import { PagesPanel } from '../pages/pages-panel.tsx';
import { useProjectStore } from '../project/project-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { ActivityBar } from '../shell/activity-bar.tsx';
import { useActivityStore } from '../shell/activity-store.ts';
import { FilesPanel } from './files-panel.tsx';
import { useFilesStore } from './files-store.ts';

vi.mock('../../api/editor-client.ts', () => ({
  openInEditor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../api/events-client.ts', () => ({
  createEventsClient: vi.fn(() => ({
    close: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  })),
}));

const MOCK_PAGES: readonly PageInfo[] = [
  { path: '/', file: 'src/pages/Home.tsx', component: 'Home', dynamic: false },
];

function setupMocks() {
  vi.spyOn(projectClient, 'fetchPages').mockResolvedValue({
    pages: [...MOCK_PAGES],
    convention: true,
  });
  vi.spyOn(projectClient, 'fetchDrafts').mockResolvedValue({
    drafts: [],
    dir: 'src/drafts',
    ignored: false,
  });
  vi.spyOn(projectClient, 'fetchProject').mockResolvedValue({
    id: 'test-proj01',
    name: 'Test Project',
    root: 'D:/test',
    sourceDir: 'src',
    support: {
      supported: true,
      reasons: [],
      language: 'ts',
      versions: {},
      styling: {
        systems: [{ id: 'tailwind', version: '4.0.0' }],
        editable: true,
        globalCss: [],
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

  vi.spyOn(filesClient, 'fetchFileTree').mockImplementation((dir) => {
    if (!dir) {
      return Promise.resolve({
        dir: '',
        entries: [
          { name: 'src', path: 'src', kind: 'directory' as const, hidden: false },
          { name: 'package.json', path: 'package.json', kind: 'file' as const, hidden: false },
        ],
        truncated: false,
      });
    }
    if (dir === 'src') {
      return Promise.resolve({
        dir: 'src',
        entries: [
          { name: 'App.tsx', path: 'src/App.tsx', kind: 'file' as const, hidden: false },
          { name: 'index.css', path: 'src/index.css', kind: 'file' as const, hidden: false },
          { name: 'components', path: 'src/components', kind: 'directory' as const, hidden: false },
          { name: 'pages', path: 'src/pages', kind: 'directory' as const, hidden: false },
        ],
        truncated: false,
      });
    }
    if (dir === 'src/components') {
      return Promise.resolve({
        dir: 'src/components',
        entries: [
          {
            name: 'Header.tsx',
            path: 'src/components/Header.tsx',
            kind: 'file' as const,
            hidden: false,
          },
        ],
        truncated: false,
      });
    }
    if (dir === 'src/pages') {
      return Promise.resolve({
        dir: 'src/pages',
        entries: [
          { name: 'Home.tsx', path: 'src/pages/Home.tsx', kind: 'file' as const, hidden: false },
        ],
        truncated: false,
      });
    }
    return Promise.resolve({ dir, entries: [], truncated: false });
  });
}

describe('FilesPanel [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    localStorage.clear();
    useFilesStore.getState().reset();
    useCanvasErrorStore.getState().reset();
    useSelectionStore.getState().reset();
    useProjectStore.getState().setProject({
      id: 'test-proj01',
      name: 'Test Project',
      root: 'D:/test',
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        language: 'ts',
        versions: {},
        styling: {
          systems: [{ id: 'tailwind', version: '4.0.0' }],
          editable: true,
          globalCss: [],
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
    setupMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('[K3b] test 12: renders root level, loads children on directory click, saves expanded to localStorage', async () => {
    render(<FilesPanel />);

    expect(await screen.findByTestId('file-row-src')).toBeDefined();
    expect(screen.getByTestId('file-row-package.json')).toBeDefined();

    fireEvent.click(screen.getByTestId('file-row-src'));

    expect(await screen.findByTestId('file-row-src/App.tsx')).toBeDefined();
    expect(screen.getByTestId('file-row-src/index.css')).toBeDefined();

    const stored = localStorage.getItem('kumicraft.files.test-proj01');
    expect(stored).toContain('src');
  });

  it('[K3b] test 13: clicking router page navigates, clicking other tsx enters component mode, clicking css opens in editor', async () => {
    const navSpy = vi.spyOn(studioBridgeChannel, 'navigate').mockImplementation(() => undefined);
    const editorSpy = vi.spyOn(editorClient, 'openInEditor').mockResolvedValue(undefined);
    const enterCompSpy = vi.spyOn(useDesignStore.getState(), 'enterComponentMode');

    render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-src'));
    expect(await screen.findByTestId('file-row-src/pages')).toBeDefined();

    fireEvent.click(screen.getByTestId('file-row-src/pages'));
    expect(await screen.findByTestId('file-row-src/pages/Home.tsx')).toBeDefined();

    fireEvent.click(screen.getByTestId('file-row-src/pages/Home.tsx'));
    expect(navSpy).toHaveBeenCalledWith('/');

    fireEvent.click(screen.getByTestId('file-row-src/App.tsx'));
    expect(enterCompSpy).toHaveBeenCalledWith({ componentName: 'App', filePath: 'src/App.tsx' });

    fireEvent.click(screen.getByTestId('file-row-src/index.css'));
    expect(editorSpy).toHaveBeenCalledWith('src/index.css:1:1');
  });

  it('[K3b] test 14: deleting file with 2 importers lists both files in dialog, cancel aborts without API call', async () => {
    vi.spyOn(filesClient, 'fetchFileImporters').mockResolvedValue({
      importers: ['src/App.tsx', 'src/Layout.tsx'],
      truncated: false,
    });
    const deleteSpy = vi.spyOn(filesClient, 'deleteProjectFile').mockResolvedValue(undefined);

    render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-package.json'));

    fireEvent.click(screen.getByTestId('file-menu-btn-package.json'));
    fireEvent.click(screen.getByTestId('files-menu-delete'));

    expect(await screen.findByText('src/App.tsx')).toBeDefined();
    expect(screen.getByText('src/Layout.tsx')).toBeDefined();

    fireEvent.click(screen.getByTestId('files-delete-cancel'));
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('[K3b] test 15: deleting router page file invokes page deletion flow without DELETE /project/files', async () => {
    const pageDeleteSpy = vi
      .spyOn(projectClient, 'deleteProjectPage')
      .mockResolvedValue({} as never);
    const fileDeleteSpy = vi.spyOn(filesClient, 'deleteProjectFile').mockResolvedValue(undefined);
    window.confirm = vi.fn().mockReturnValue(true);

    render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-src'));
    fireEvent.click(await screen.findByTestId('file-row-src/pages'));
    expect(await screen.findByTestId('file-row-src/pages/Home.tsx')).toBeDefined();

    fireEvent.click(screen.getByTestId('file-menu-btn-src/pages/Home.tsx'));
    fireEvent.click(screen.getByTestId('files-menu-delete'));

    await waitFor(() => {
      expect(pageDeleteSpy).toHaveBeenCalledWith({ path: '/' });
    });
    expect(fileDeleteSpy).not.toHaveBeenCalled();
  });

  it('[K3b] test 16: inline rename calls rename API on Enter, cancels on Esc, rejects colon inline', async () => {
    const renameSpy = vi.spyOn(filesClient, 'renameProjectFile').mockResolvedValue(undefined);

    render(<FilesPanel />);
    await screen.findByTestId('file-row-package.json');

    fireEvent.click(screen.getByTestId('file-menu-btn-package.json'));
    fireEvent.click(screen.getByTestId('files-menu-rename'));

    const input = await screen.findByTestId('files-inline-rename-input');
    fireEvent.change(input, { target: { value: 'pkg:invalid.json' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('files-inline-error')).toBeDefined();
    expect(renameSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('files-inline-rename-input')).toBeNull();

    fireEvent.click(screen.getByTestId('file-menu-btn-package.json'));
    fireEvent.click(screen.getByTestId('files-menu-rename'));
    const input2 = await screen.findByTestId('files-inline-rename-input');
    fireEvent.change(input2, { target: { value: 'package2.json' } });
    fireEvent.keyDown(input2, { key: 'Enter' });

    await waitFor(() => {
      expect(renameSpy).toHaveBeenCalledWith({
        from: 'package.json',
        to: 'package2.json',
      });
    });
  });

  it('[K3b] test 16b: server refusals show their reason in the rename input and the delete dialog', async () => {
    vi.spyOn(filesClient, 'renameProjectFile').mockRejectedValue(
      new ApiError(400, 'E016', { reason: 'entryExists' }),
    );
    vi.spyOn(filesClient, 'fetchFileImporters').mockResolvedValue({
      importers: [],
      truncated: false,
    });
    vi.spyOn(filesClient, 'deleteProjectFile').mockRejectedValue(
      new ApiError(400, 'E016', { reason: 'folderTooLarge' }),
    );

    render(<FilesPanel />);
    await screen.findByTestId('file-row-package.json');

    fireEvent.click(screen.getByTestId('file-menu-btn-package.json'));
    fireEvent.click(screen.getByTestId('files-menu-rename'));
    const input = await screen.findByTestId('files-inline-rename-input');
    fireEvent.change(input, { target: { value: 'src' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect((await screen.findByTestId('files-inline-error')).textContent).toContain('(E016)');
    expect(screen.getByTestId('files-inline-rename-input')).toBeDefined();
    fireEvent.keyDown(screen.getByTestId('files-inline-rename-input'), { key: 'Escape' });

    fireEvent.click(screen.getByTestId('file-menu-btn-src'));
    fireEvent.click(screen.getByTestId('files-menu-delete'));
    fireEvent.click(await screen.findByTestId('files-delete-confirm'));
    expect((await screen.findByTestId('files-delete-error')).textContent).toContain('(E016)');
  });

  it('[K3b] test 17: build error at src/App.tsx shows red dot on row, dot on src folder, and badge on activity bar', async () => {
    useCanvasErrorStore.getState().setBuildError({
      message: 'Failed to compile',
      file: 'src/App.tsx',
    });

    render(
      <div>
        <ActivityBar />
        <FilesPanel />
      </div>,
    );

    expect(await screen.findByTestId('build-error-folder-dot')).toBeDefined();

    const activityFiles = screen.getByTestId('activity-files');
    expect(activityFiles.querySelector('.bg-rose-500')).toBeDefined();

    fireEvent.click(screen.getByTestId('file-row-src'));
    expect(await screen.findByTestId('build-error-dot')).toBeDefined();
  });

  it('[K3b] test 18: element selection with loc src/components/Header.tsx:3:5 expands parent dirs and highlights file', async () => {
    render(<FilesPanel />);
    await screen.findByTestId('file-row-src');

    useSelectionStore.getState().setSelectedRefs([
      {
        loc: 'src/components/Header.tsx:3:5',
        index: 0,
      },
    ]);

    expect(await screen.findByTestId('file-row-src/components/Header.tsx')).toBeDefined();
    const row = screen.getByTestId('file-row-src/components/Header.tsx');
    expect(row.className).toContain('font-semibold');
  });

  it('[K3b] test 19: project.filesChanged event for file in open directory reloads that directory', async () => {
    render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-src'));
    await screen.findByTestId('file-row-src/App.tsx');

    const treeSpy = vi.spyOn(filesClient, 'fetchFileTree');

    await useFilesStore.getState().refreshAffected(['src/App.tsx']);

    expect(treeSpy).toHaveBeenCalledWith('src');
  });

  it('[WP-4.00] test 18: studio files-panel test: Chuột phải thư mục → "Thêm trang ở đây" → panel Trang mở form với thư mục đó', async () => {
    const { unmount } = render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-src'));
    await screen.findByTestId('file-row-src/pages');

    fireEvent.click(screen.getByTestId('file-menu-btn-src/pages'));
    const addPageItem = await screen.findByTestId('files-menu-add-page');
    fireEvent.click(addPageItem);

    expect(useActivityStore.getState().active).toBe('pages');
    unmount();

    render(<PagesPanel />);
    const pageDirInput = await screen.findByTestId<HTMLInputElement>('page-dir');
    expect(pageDirInput.value).toBe('src/pages');
  });

  it('[WP-4.00] test 19: studio files-panel test: Chuột phải thư mục → "Dùng làm thư mục component" → PATCH /project thêm vào cuối; thư mục đã có → Bỏ khỏi, không bỏ được thư mục cuối', async () => {
    const patchSpy = vi.spyOn(projectClient, 'patchProject').mockResolvedValue({
      id: 'test-proj01',
      name: 'Test Project',
      root: 'D:/test',
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        language: 'ts',
        versions: {},
        styling: { systems: [{ id: 'tailwind', version: '4.0.0' }], editable: true, globalCss: [] },
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
        components: ['src/components', 'src/pages'],
        drafts: 'src/drafts',
      },
    });

    render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-src'));
    await screen.findByTestId('file-row-src/pages');

    // Right-click src/pages: item is enabled
    fireEvent.click(screen.getByTestId('file-menu-btn-src/pages'));
    const useCompItem = await screen.findByTestId<HTMLButtonElement>(
      'files-menu-use-components-dir',
    );
    expect(useCompItem.disabled).toBe(false);

    fireEvent.click(useCompItem);
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalled();
    });
    const patchCall = patchSpy.mock.calls[0]?.[0];
    expect(patchCall?.designDirs?.components).toEqual(['src/components', 'src/pages']);

    // src/components is already a component folder: the item removes it instead.
    fireEvent.click(await screen.findByTestId('file-menu-btn-src/components'));
    expect(screen.queryByTestId('files-menu-use-components-dir') ?? undefined).toBeUndefined();
    fireEvent.click(
      await screen.findByTestId<HTMLButtonElement>('files-menu-remove-components-dir'),
    );
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledTimes(2);
    });
    expect(patchSpy.mock.calls[1]?.[0].designDirs?.components).toEqual(['src/pages']);

    // The only page folder cannot be removed.
    fireEvent.click(await screen.findByTestId('file-menu-btn-src/pages'));
    const removePages = await screen.findByTestId<HTMLButtonElement>('files-menu-remove-pages-dir');
    expect(removePages.disabled).toBe(true);
  });

  it('[WP-4.00] a refused design folder change shows its reason in the Files panel', async () => {
    vi.spyOn(projectClient, 'patchProject').mockRejectedValue(
      new ApiError(400, 'E016', { reason: 'designDirs' }),
    );
    render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-src'));
    await screen.findByTestId('file-row-src/pages');

    fireEvent.click(screen.getByTestId('file-menu-btn-src/pages'));
    fireEvent.click(await screen.findByTestId('files-menu-use-layouts-dir'));

    expect((await screen.findByTestId('files-action-error')).textContent).toContain('(E016)');
  });
});
