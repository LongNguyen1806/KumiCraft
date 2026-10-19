// Unit tests for Studio drafts feature (SPEC-04 WP-2.11, R-DR-10 to R-DR-15).
import type { DraftInfo } from '@reactcraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { DesignBar } from '../design/design-bar.tsx';
import { useDesignStore, useDesignTargetSync } from '../design/design-store.ts';
import { computeIframeSrc } from '../editor/canvas-frame.tsx';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { PageSelect } from '../editor/page-select.tsx';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { DraftsDialog } from './drafts-dialog.tsx';
import { PromoteDraftDialog } from './promote-draft-dialog.tsx';

describe('Studio Drafts [R-DR-10 .. R-DR-15]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useCanvasViewStore.setState({ draftFile: undefined });
    useDesignStore.setState({ target: undefined, componentMode: undefined });
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(projectClient, 'fetchPages').mockResolvedValue({
      convention: false,
      pages: [{ path: '/', component: 'Home', dynamic: false }],
    });
    vi.spyOn(projectClient, 'fetchDrafts').mockResolvedValue({
      drafts: [
        {
          name: 'BanNhap1',
          file: 'src/drafts/BanNhap1.tsx',
          free: false,
          inUse: false,
        },
      ],
      dir: 'src/drafts',
      ignored: false,
    });
    vi.spyOn(projectClient, 'fetchProject').mockResolvedValue({
      id: 'shop000001',
      name: 'Shop',
      root: '/projects/shop',
      sourceDir: 'src',
      support: {
        supported: true,
        reasons: [],
        framework: 'vite-react',
        versions: {},
        language: 'ts',
      },
      needsInstall: false,
      responsiveMode: 'desktop-first',
      frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
      primaryFrameId: 'desktop',
      backends: [],
      trusted: true,
      designDirs: {
        pages: 'src/pages',
        layouts: 'src/layouts',
        components: 'src/components',
        drafts: 'src/drafts',
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('scenario 15: selecting draft updates draftFile, sets draft iframe URL, design bar and setDesignFile', async () => {
    useSelectionStore.setState({ bridgeReady: true, currentRoute: '/' });
    const setDesignSpy = vi
      .spyOn(studioBridgeChannel, 'setDesignFile')
      .mockImplementation(() => undefined);
    function App() {
      useDesignTargetSync();
      return (
        <div>
          <DesignBar />
          <PageSelect />
        </div>
      );
    }
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByTestId('canvas-page-select').querySelectorAll('option').length,
      ).toBeGreaterThan(1);
    });

    fireEvent.change(screen.getByTestId('canvas-page-select'), {
      target: { value: 'draft:src/drafts/BanNhap1.tsx' },
    });

    expect(useCanvasViewStore.getState().draftFile).toBe('src/drafts/BanNhap1.tsx');
    const iframeSrc = computeIframeSrc('http://127.0.0.1:5173', 'src/drafts/BanNhap1.tsx');
    expect(iframeSrc).toBe(
      'http://127.0.0.1:5173/__reactcraft/draft?file=src%2Fdrafts%2FBanNhap1.tsx',
    );

    await waitFor(() => {
      expect(screen.getByTestId('design-bar-name').textContent).toBe('BanNhap1');
      expect(screen.getByTestId('design-bar-file').textContent).toBe('src/drafts/BanNhap1.tsx');
    });

    expect(setDesignSpy).toHaveBeenCalledWith('src/drafts/BanNhap1.tsx', false);
  });

  it('scenario 16: selecting page while in draft clears draftFile and restores page iframe URL', async () => {
    useCanvasViewStore.setState({ draftFile: 'src/drafts/BanNhap1.tsx' });
    render(<PageSelect />);

    await waitFor(() => {
      expect(
        screen.getByTestId('canvas-page-select').querySelectorAll('option').length,
      ).toBeGreaterThan(1);
    });

    fireEvent.change(screen.getByTestId('canvas-page-select'), {
      target: { value: '/' },
    });

    expect(useCanvasViewStore.getState().draftFile).toBeUndefined();
    const pageIframeSrc = computeIframeSrc('http://127.0.0.1:5173', undefined);
    expect(pageIframeSrc).toBe('http://127.0.0.1:5173/');
  });

  it('scenario 17: DraftsDialog disables delete for inUse draft, shows draft-in-use and ignored warning', () => {
    const sampleDrafts: readonly DraftInfo[] = [
      { name: 'Mockup', file: 'src/drafts/Mockup.tsx', free: false, inUse: true },
      { name: 'Draft2', file: 'src/drafts/Draft2.tsx', free: false, inUse: false },
    ];

    render(<DraftsDialog open={true} drafts={sampleDrafts} ignored={true} onClose={() => {}} />);

    expect(screen.getByTestId('drafts-ignored-warning')).toBeDefined();
    expect(screen.getByTestId('draft-in-use')).toBeDefined();
    expect(screen.getByTestId('draft-delete-src/drafts/Mockup.tsx')).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByTestId('draft-delete-src/drafts/Draft2.tsx')).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('scenario 18: PromoteDraftDialog shows promote-free-warning for free draft and promote-keep is checked by default', () => {
    const freeDraft: DraftInfo = {
      name: 'FreeMockup',
      file: 'src/drafts/FreeMockup.tsx',
      free: true,
      inUse: false,
    };

    render(<PromoteDraftDialog open={true} draft={freeDraft} onClose={() => {}} />);

    expect(screen.getByTestId('promote-free-warning')).toBeDefined();
    expect(screen.getByTestId('promote-keep')).toHaveProperty('checked', true);
  });
});
