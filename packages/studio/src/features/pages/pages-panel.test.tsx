import type { PageInfo, ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as jobsClient from '../../api/jobs-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { FilesContextMenu } from '../files/files-context-menu.tsx';
import { useProjectStore } from '../project/project-store.ts';
import { AddPageForm } from './add-page-form.tsx';
import { PagesPanel } from './pages-panel.tsx';

const MOCK_PROJECT: ProjectInfo = {
  id: 'test-proj01',
  name: 'Test Project',
  root: 'D:/test',
  sourceDir: 'src',
  support: {
    supported: true,
    reasons: [],
    language: 'js',
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
};

describe('PagesPanel & AddPageForm [WP-2.05]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  beforeEach(() => {
    vi.spyOn(projectClient, 'fetchPages').mockResolvedValue({
      pages: [],
      convention: false,
      router: { status: 'none', hasRouterPackage: false },
    });
    vi.spyOn(jobsClient, 'fetchJob').mockResolvedValue({
      id: 'job-router-1',
      kind: 'project.install',
      state: 'running',
      lines: [],
      startedAt: '2026-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('scenario 17: auto-suggests path and file, keeping manual path edits [R-PG-11]', () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages', 'src/components']);
    render(<AddPageForm convention={true} />);

    const nameInput = screen.getByTestId('page-name');
    const pathInput = screen.getByTestId('page-path');
    const fileInput = screen.getByTestId('page-file');

    fireEvent.change(nameInput, { target: { value: 'Giới thiệu' } });
    expect(pathInput).toHaveProperty('value', '/gioi-thieu');
    // The file name is left to the server, which follows the folder's pages (K3d).
    expect(fileInput).toHaveProperty('value', '');
    expect(fileInput.getAttribute('placeholder')).toContain('GioiThieu');

    fireEvent.change(pathInput, { target: { value: '/gioi-thieu-chung' } });
    expect(pathInput).toHaveProperty('value', '/gioi-thieu-chung');

    fireEvent.change(nameInput, { target: { value: 'Giới thiệu công ty' } });
    expect(pathInput).toHaveProperty('value', '/gioi-thieu-chung');
    expect(fileInput.getAttribute('placeholder')).toContain('GioiThieuCongTy');
  });

  it('scenario 18: locks add/rename/delete when convention is false and displays note [R-PG-10]', () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages']);
    const mockPages: readonly PageInfo[] = [
      { path: '/', component: 'Home', dynamic: false },
      { path: '/about', component: 'About', dynamic: false },
    ];

    render(<PagesPanel pages={mockPages} convention={false} />);

    expect(screen.getByTestId('pages-panel')).toBeDefined();
    expect(screen.getByTestId('pages-not-convention')).toBeDefined();

    const addButton = screen.getByTestId('page-add');
    expect(addButton).toHaveProperty('disabled', true);

    const renameHome = screen.getByTestId('page-rename-/');
    expect(renameHome).toHaveProperty('disabled', true);

    const deleteHome = screen.getByTestId('page-delete-/');
    expect(deleteHome).toHaveProperty('disabled', true);

    const renameAbout = screen.getByTestId('page-rename-/about');
    expect(renameAbout).toHaveProperty('disabled', true);

    const deleteAbout = screen.getByTestId('page-delete-/about');
    expect(deleteAbout).toHaveProperty('disabled', true);
  });

  it('B5: PagesPanel with router.status === ambiguous renders 2 candidate buttons and clicking calls PATCH /project [WP-4.00]', async () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages']);
    const patchSpy = vi.spyOn(projectClient, 'patchProject').mockResolvedValue(MOCK_PROJECT);

    render(
      <PagesPanel
        pages={[]}
        router={{
          status: 'ambiguous',
          candidates: ['src/routes.jsx', 'src/admin-routes.jsx'],
        }}
      />,
    );

    const btn1 = screen.getByTestId('router-candidate-src/routes.jsx');
    const btn2 = screen.getByTestId('router-candidate-src/admin-routes.jsx');
    expect(btn1.textContent).toBe('src/routes.jsx');
    expect(btn2.textContent).toBe('src/admin-routes.jsx');

    fireEvent.click(btn2);
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({ routing: { file: 'src/admin-routes.jsx' } });
    });
  });

  it('B6: PagesPanel with router.status === found and chosen: true shows file, Doi... and Tu tim buttons; clicking Tu tim calls PATCH /project [WP-4.00]', async () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages']);
    const patchSpy = vi.spyOn(projectClient, 'patchProject').mockResolvedValue(MOCK_PROJECT);

    render(
      <PagesPanel
        pages={[{ path: '/', component: 'Home', dynamic: false }]}
        router={{
          status: 'found',
          file: 'src/app/routes.jsx',
          line: 1,
          kind: 'dataRouter',
          chosen: true,
        }}
      />,
    );

    expect(screen.getByTestId('router-status-found').textContent).toContain('src/app/routes.jsx');
    expect(screen.getByTestId('router-change-file').textContent).toBe('Đổi…');
    const autoBtn = screen.getByTestId('router-auto-file');
    expect(autoBtn.textContent).toBe('Tự tìm');

    fireEvent.click(autoBtn);
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({ routing: {} });
    });
  });

  it('B7: PagesPanel with router.status === none shows Cai router button and confirming dialog calls POST /project/router/install [WP-4.00]', async () => {
    vi.spyOn(projectClient, 'fetchProjectDirs').mockResolvedValue(['src/pages']);
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    const installSpy = vi
      .spyOn(projectClient, 'installProjectRouter')
      .mockResolvedValue({ jobId: 'job-router-1' });

    render(
      <PagesPanel
        pages={[]}
        router={{
          status: 'none',
          hasRouterPackage: false,
        }}
      />,
    );

    const installBtn = screen.getByTestId('router-install-btn');
    expect(installBtn.textContent).toBe('Cài router');
    fireEvent.click(installBtn);

    expect(screen.getByTestId('router-install-dialog')).toBeDefined();
    fireEvent.click(screen.getByTestId('router-install-confirm'));

    await waitFor(() => {
      expect(installSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('B8: File tree right-click context menu on a .jsx file renders Dung lam file router and clicking calls PATCH /project [WP-4.00]', async () => {
    useProjectStore.getState().setProject(MOCK_PROJECT);
    const patchSpy = vi.spyOn(projectClient, 'patchProject').mockResolvedValue(MOCK_PROJECT);

    render(
      <FilesContextMenu
        open={true}
        x={10}
        y={10}
        entry={{ name: 'routes.jsx', path: 'src/routes.jsx', kind: 'file', hidden: false }}
        onClose={vi.fn()}
        onOpenInEditor={vi.fn()}
        onNewFile={vi.fn()}
        onNewFolder={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );

    const routerItem = screen.getByTestId('files-menu-use-router-file');
    expect(routerItem.textContent).toContain('Dùng làm file router');
    fireEvent.click(routerItem);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({ routing: { file: 'src/routes.jsx' } });
    });
  });
});
