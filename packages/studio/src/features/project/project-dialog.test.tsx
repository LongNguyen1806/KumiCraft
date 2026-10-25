import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { ProjectDialog } from './project-dialog.tsx';

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const urlStr = url;
      const method = init?.method ?? 'GET';

      if (urlStr.includes('/api/v1/fs/directories')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                path: '/test/workspace',
                entries: [
                  { name: 'app-a', path: '/test/workspace/app-a', isProject: true },
                  { name: 'notes', path: '/test/workspace/notes', isProject: false },
                ],
              },
            }),
            { status: 200 },
          ),
        );
      }

      if (urlStr.includes('/api/v1/project/probe')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                kind: 'project',
                support: {
                  supported: true,
                  reasons: [],
                  framework: 'vite-react',
                  versions: {},
                  language: 'ts',
                  tailwindCss: 'src/index.css',
                },
                hasWorkspace: true,
              },
            }),
            { status: 200 },
          ),
        );
      }

      if (urlStr.includes('/api/v1/project/open') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                id: 'shop000001',
                name: 'Shop',
                root: '/test/workspace',
                sourceDir: 'src',
                support: { supported: true, reasons: [], versions: {}, language: 'ts' },
                needsInstall: false,
                responsiveMode: 'desktop-first',
                frames: [],
                primaryFrameId: 'desktop',
                backends: [],
                trusted: true,
                designDirs: {
                  pages: ['src/pages'],
                  components: ['src/components'],
                  layouts: ['src/layouts'],
                  drafts: 'src/drafts',
                },
              },
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    }),
  );
}

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18next.changeLanguage('en');
  sessionStorage.setItem('kumicraft.sessionToken', 'tok');
  stubApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ProjectDialog', () => {
  it('renders directory browser and probes initial path [R-PJ-20]', async () => {
    render(
      <ProjectDialog
        open={true}
        initialPath="/test/workspace"
        onClose={vi.fn()}
        onProjectOpened={vi.fn()}
      />,
    );

    expect(screen.getByTestId('project-dialog')).toBeDefined();
    expect(screen.getByTestId('directory-browser')).toBeDefined();

    // Wait for probe result
    await waitFor(() => {
      expect(screen.getByTestId('open-project-btn')).toBeDefined();
    });
  });

  it('triggers onProjectOpened when Open button is clicked', async () => {
    const onOpened = vi.fn();
    render(
      <ProjectDialog
        open={true}
        initialPath="/test/workspace"
        onClose={vi.fn()}
        onProjectOpened={onOpened}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('open-project-btn')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('open-project-btn'));

    await waitFor(() => {
      expect(onOpened).toHaveBeenCalledWith(expect.objectContaining({ id: 'shop000001' }));
    });
  });

  it('lists translated reasons for an unsupported folder [R-PJ-21]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/api/v1/fs/directories')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: {
                  path: '/test/workspace',
                  entries: [],
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
                  kind: 'project',
                  support: {
                    supported: false,
                    reasons: ['noVite', 'noTailwind'],
                    versions: {},
                    language: 'js',
                  },
                  hasWorkspace: false,
                },
              }),
              { status: 200 },
            ),
          );
        }

        return Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
      }),
    );

    render(
      <ProjectDialog
        open={true}
        initialPath="/test/workspace"
        onClose={vi.fn()}
        onProjectOpened={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(i18next.t('project.reasons.noVite'))).toBeDefined();
      expect(screen.getByText(i18next.t('project.reasons.noTailwind'))).toBeDefined();
    });

    expect(screen.queryByTestId('open-project-btn')).toBeNull();
  });

  it('Situation #13: probe CSS Modules project shows probe-styling and probe-style-edit [R-PJ-02]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/api/v1/project/dirs/list')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: { path: '/test/css-modules', entries: [] },
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
                  kind: 'project',
                  hasWorkspace: true,
                  support: {
                    supported: true,
                    reasons: [],
                    framework: 'vite-react',
                    versions: {},
                    language: 'ts',
                    styling: {
                      systems: [{ id: 'cssModules' }, { id: 'css' }],
                      primary: 'cssModules',
                      editable: false,
                      globalCss: ['src/index.css'],
                    },
                  },
                },
              }),
              { status: 200 },
            ),
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
      }),
    );

    render(
      <ProjectDialog
        open={true}
        initialPath="/test/css-modules"
        onClose={vi.fn()}
        onProjectOpened={vi.fn()}
      />,
    );

    await waitFor(() => {
      const stylingEl = screen.getByTestId('probe-styling');
      expect(stylingEl.textContent).toContain('CSS Modules');
      expect(stylingEl.textContent).toContain(
        i18next.t('styling.css', { defaultValue: 'CSS thường' }),
      );
      const editEl = screen.getByTestId('probe-style-edit');
      expect(editEl.textContent).toContain(
        i18next.t('project.styleNotEditable', {
          defaultValue:
            'Chỉnh kiểu dáng trực quan: chưa hỗ trợ cho hệ này, dùng AI để đổi kiểu dáng',
        }),
      );
    });
  });
});
