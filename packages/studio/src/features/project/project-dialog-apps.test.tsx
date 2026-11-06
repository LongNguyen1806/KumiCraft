// Tests for ProjectDialog with apps probe (SPEC-04 K5, WP-4.00 M8).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { ProjectDialog } from './project-dialog.tsx';

describe('ProjectDialog Apps Probe [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('Test M8 [WP-4.00]: Studio probe apps renders 3 candidates, opening frontend opens <root>/frontend, CRA displays reason without open button', async () => {
    let openedPath = '';

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : '';
      const method = init?.method ?? 'GET';

      if (url.includes('/api/v1/project/dirs')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                current: '/workspace/monorepo',
                parent: '/workspace',
                directories: [],
              },
            }),
            { status: 200 },
          ),
        );
      }

      if (url.includes('/api/v1/project/probe')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                kind: 'apps',
                apps: [
                  {
                    path: 'frontend',
                    framework: 'vite-react',
                    kind: 'vite-react',
                    supported: true,
                    reasons: [],
                  },
                  {
                    path: 'legacy-cra',
                    kind: 'cra',
                    supported: false,
                    reasons: ['craUnsupported'],
                  },
                  {
                    path: 'next-site',
                    kind: 'next',
                    supported: false,
                    reasons: ['nextUnsupported'],
                  },
                ],
              },
            }),
            { status: 200 },
          ),
        );
      }

      if (url.includes('/api/v1/project/open') && method === 'POST') {
        const rawBody = typeof init?.body === 'string' ? init.body : '{}';
        const body = JSON.parse(rawBody) as { path?: string };
        openedPath = body.path ?? '';
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                id: 'front00001',
                name: 'Frontend',
                root: openedPath,
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
                frames: [],
                primaryFrameId: 'desktop',
                backends: [],
                designDirs: {
                  pages: ['src/pages'],
                  layouts: ['src/layouts'],
                  components: ['src/components'],
                  drafts: 'src/drafts',
                },
                trusted: true,
              },
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    });

    const onProjectOpened = vi.fn();
    const onClose = vi.fn();

    render(
      <ProjectDialog
        open={true}
        initialPath="/workspace/monorepo"
        onClose={onClose}
        onProjectOpened={onProjectOpened}
      />,
    );

    // Wait for apps view to render
    await waitFor(() => {
      expect(screen.getByTestId('app-candidate-frontend')).toBeDefined();
    });

    expect(screen.getByTestId('app-candidate-legacy-cra')).toBeDefined();
    expect(screen.getByTestId('app-candidate-next-site')).toBeDefined();

    // CRA candidate shows reason and no open button
    const craCandidate = screen.getByTestId('app-candidate-legacy-cra');
    expect(craCandidate.textContent).toContain(
      i18next.t('project.reasons.craUnsupported', {
        defaultValue: 'Create React App đã bị React ngừng phát triển',
      }),
    );
    expect(screen.queryByTestId('app-candidate-open-legacy-cra')).toBeNull();

    // Frontend candidate has open button, clicking it opens /workspace/monorepo/frontend
    const openFrontendBtn = screen.getByTestId('app-candidate-open-frontend');
    fireEvent.click(openFrontendBtn);

    await waitFor(() => {
      expect(openedPath).toBe('/workspace/monorepo/frontend');
      expect(onProjectOpened).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
