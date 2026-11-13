// A draft clicked in Files opens as the draft it is (spec-log #130): it used to enter component
// mode for the page shown, which greyed out everything and left nothing to select.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as filesClient from '../../api/files-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
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

describe('FilesPanel opens drafts as drafts [spec-log #130]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    localStorage.clear();
    useFilesStore.getState().reset();
    vi.spyOn(projectClient, 'fetchPages').mockResolvedValue({
      pages: [],
      convention: true,
      routesFile: 'src/routes.tsx',
      router: {
        status: 'found',
        file: 'src/routes.tsx',
        line: 1,
        kind: 'dataRouter',
        chosen: false,
      },
    });
    vi.spyOn(projectClient, 'fetchDrafts').mockResolvedValue({
      drafts: [],
      dir: 'src/drafts',
      ignored: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('clicking a draft opens it as a draft, not as a component of the page [spec-log #130]', async () => {
    const enterCompSpy = vi.spyOn(useDesignStore.getState(), 'enterComponentMode');
    useCanvasViewStore.setState({ draftsDir: 'src/drafts', draftFile: undefined });
    vi.spyOn(filesClient, 'fetchFileTree').mockImplementation((dir) =>
      Promise.resolve(
        dir === 'src/drafts'
          ? {
              dir,
              entries: [
                {
                  name: 'BanNhap1.tsx',
                  path: 'src/drafts/BanNhap1.tsx',
                  kind: 'file' as const,
                  hidden: false,
                },
              ],
              truncated: false,
            }
          : {
              dir: dir ?? '',
              entries: [
                {
                  name: dir ? 'drafts' : 'src',
                  path: dir ? 'src/drafts' : 'src',
                  kind: 'directory' as const,
                  hidden: false,
                },
              ],
              truncated: false,
            },
      ),
    );

    render(<FilesPanel />);
    fireEvent.click(await screen.findByTestId('file-row-src'));
    fireEvent.click(await screen.findByTestId('file-row-src/drafts'));
    fireEvent.click(await screen.findByTestId('file-row-src/drafts/BanNhap1.tsx'));

    expect(useCanvasViewStore.getState().draftFile).toBe('src/drafts/BanNhap1.tsx');
    expect(enterCompSpy).not.toHaveBeenCalled();
  });
});
