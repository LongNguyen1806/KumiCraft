import { DEFAULT_DESIGN_DIRS, type ProjectInfo, type RunnerStatus } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { useProjectStore } from '../project/project-store.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { CanvasArea } from './canvas-area.tsx';
import { useSessionPickerStore } from './session-pages.ts';
import { resetSessionProbeCache } from './session-select.tsx';

let mockRunnerState: {
  status: RunnerStatus;
  logTail: string[];
  start: () => void;
  restart: () => void;
} = {
  status: { state: 'stopped' },
  logTail: [],
  start: vi.fn(),
  restart: vi.fn(),
};

vi.mock('./use-runner-status.ts', () => ({
  useRunnerStatus: () => mockRunnerState,
}));

const mockProject: ProjectInfo = {
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
  frames: [
    { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
    { id: 'mobile', label: 'Mobile', width: 375, height: 667 },
  ],
  primaryFrameId: 'desktop',
  backends: [],
  trusted: true,
  designDirs: DEFAULT_DESIGN_DIRS,
};

/** Turns on the advanced login sessions option (spec-log #77) for one test. */
function enableLoginSessions() {
  useSettingsStore.setState({
    settings: { editor: 'vscode', agent: { preferred: 'auto' }, loginSessions: true },
  });
}

describe('CanvasArea', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  beforeEach(() => {
    localStorage.clear();
    resetSessionProbeCache();
    useProjectStore.getState().setProject(undefined);
    useSelectionStore.getState().reset();
    vi.spyOn(projectClient, 'fetchPages').mockResolvedValue({
      pages: [],
      convention: false,
      router: { status: 'none', hasRouterPackage: false },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useSettingsStore.setState({ settings: undefined });
    useSessionPickerStore.setState({ open: false });
  });

  it('renders untrusted prompt when trusted is false [R-RN-20]', () => {
    const onTrust = vi.fn();
    render(<CanvasArea projectInfo={mockProject} trusted={false} onTrustRequest={onTrust} />);
    expect(screen.getByTestId('canvas-untrusted')).toBeDefined();
    const btn = screen.getByTestId('canvas-trust-btn');
    fireEvent.click(btn);
    expect(onTrust).toHaveBeenCalledTimes(1);
  });

  it('renders needs-install prompt when project needs install [R-RN-20]', () => {
    const onInstall = vi.fn();
    render(
      <CanvasArea
        projectInfo={{ ...mockProject, needsInstall: true }}
        trusted
        onInstallRequest={onInstall}
      />,
    );
    expect(screen.getByTestId('canvas-needs-install')).toBeDefined();
    const btn = screen.getByTestId('canvas-install-btn');
    fireEvent.click(btn);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('renders stopped view with run button when runner is stopped [R-RN-20]', () => {
    const start = vi.fn();
    mockRunnerState = {
      status: { state: 'stopped' },
      logTail: [],
      start,
      restart: vi.fn(),
    };
    render(<CanvasArea projectInfo={mockProject} trusted />);
    expect(screen.getByTestId('canvas-stopped')).toBeDefined();
    const btn = screen.getByTestId('canvas-run-btn');
    fireEvent.click(btn);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('renders loading spinner when runner is starting [R-RN-20]', () => {
    mockRunnerState = {
      status: { state: 'starting' },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    render(<CanvasArea projectInfo={mockProject} trusted />);
    expect(screen.getByTestId('canvas-loading')).toBeDefined();
  });

  it('renders iframe when runner is ready [R-RN-20]', () => {
    mockRunnerState = {
      status: { state: 'ready', origin: 'http://127.0.0.1:5173' },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    render(<CanvasArea projectInfo={mockProject} trusted />);
    const iframe = screen.getByTestId('canvas-iframe');
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute('src')).toBe('http://127.0.0.1:5173/');
  });

  it('shows the current page path on the Canvas toolbar [R-RN-26]', () => {
    useSelectionStore.getState().setRoute('/products/42');

    render(<CanvasArea projectInfo={mockProject} trusted />);

    expect(screen.getByTestId('canvas-route').textContent).toBe('/products/42');
    expect(screen.getByTestId('pages-manage')).toBeDefined();
    expect(screen.getByTestId('canvas-mode-toggle')).toBeDefined();
  });

  it('sandboxes the project page so it cannot navigate the Studio [S-100]', () => {
    mockRunnerState = {
      status: { state: 'ready', origin: 'http://127.0.0.1:5173' },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    render(<CanvasArea projectInfo={mockProject} trusted />);

    const tokens = (screen.getByTestId('canvas-iframe').getAttribute('sandbox') ?? '').split(' ');
    expect(tokens.sort()).toEqual(
      [
        'allow-downloads',
        'allow-forms',
        'allow-modals',
        'allow-popups',
        'allow-popups-to-escape-sandbox',
        'allow-same-origin',
        'allow-scripts',
      ].sort(),
    );
    expect(tokens.some((token) => token.startsWith('allow-top-navigation'))).toBe(false);
  });

  it('renders error view with restart button when runner fails [R-RN-20]', () => {
    const restart = vi.fn();
    mockRunnerState = {
      status: {
        state: 'error',
        error: { code: 'E025', params: { message: 'Vite crashed on startup' } },
      },
      logTail: ['error line 1', 'error line 2'],
      start: vi.fn(),
      restart,
    };
    render(<CanvasArea projectInfo={mockProject} trusted />);
    expect(screen.getByTestId('canvas-error')).toBeDefined();
    expect(screen.getByText('Vite crashed on startup')).toBeDefined();
    const btn = screen.getByTestId('canvas-restart-btn');
    fireEvent.click(btn);
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('[WP-4.00] login sessions are off by default: no session picker, the Canvas uses session 1', () => {
    mockRunnerState = {
      status: { state: 'ready', origin: 'http://127.0.0.1:5173', nonce: 'n'.repeat(22) },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    localStorage.setItem(`kumicraft.session.${mockProject.id}`, '2');
    render(
      <CanvasArea
        projectInfo={{
          ...mockProject,
          sessions: [
            { id: 1, label: '1' },
            { id: 2, label: 'Farmer' },
          ],
        }}
        trusted
      />,
    );
    expect(screen.queryByTestId('session-select-trigger') ?? undefined).toBeUndefined();
    expect(screen.getByTestId('canvas-iframe').getAttribute('src')).toContain('127.0.0.1:5173');
  });

  it('D2: switching session 1 -> 2 updates iframe src to s2.localhost, calls bridgeChannel.attach with s2.localhost, and ignores messages from session 1 origin [WP-4.00]', async () => {
    enableLoginSessions();
    const nonce = 'n'.repeat(22);
    mockRunnerState = {
      status: { state: 'ready', origin: 'http://127.0.0.1:5173', nonce },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    useSelectionStore.getState().setRoute('/dashboard');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    const attachSpy = vi.spyOn(studioBridgeChannel, 'attach');

    const projectWithTwoSessions: ProjectInfo = {
      ...mockProject,
      sessions: [
        { id: 1, label: 'Phiên 1' },
        { id: 2, label: 'Admin' },
      ],
    };
    render(<CanvasArea projectInfo={projectWithTwoSessions} trusted />);

    const iframe = screen.getByTestId<HTMLIFrameElement>('canvas-iframe');
    expect(iframe.getAttribute('src')).toBe('http://127.0.0.1:5173/dashboard');

    fireEvent.click(screen.getByTestId('session-select-trigger'));
    fireEvent.click(screen.getByTestId('session-item-2'));

    await waitFor(() => {
      expect(iframe.getAttribute('src')).toBe('http://s2.localhost:5173/dashboard');
    });
    expect(attachSpy).toHaveBeenLastCalledWith(
      iframe.contentWindow,
      'http://s2.localhost:5173',
      nonce,
    );

    // Message from session 1 origin after switching to session 2 must be ignored.
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://127.0.0.1:5173',
        source: iframe.contentWindow,
        data: { rc: 1, nonce, type: 'route', payload: { route: '/from-session-1' } },
      }),
    );
    expect(useSelectionStore.getState().currentRoute).toBe('/dashboard');

    // Message from session 2 origin is accepted.
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://s2.localhost:5173',
        source: iframe.contentWindow,
        data: { rc: 1, nonce, type: 'route', payload: { route: '/from-session-2' } },
      }),
    );
    expect(useSelectionStore.getState().currentRoute).toBe('/from-session-2');
  });

  it('D3: adding session Admin calls PATCH /project with sessions [1, 2]; session 1 has no delete button [WP-4.00]', async () => {
    enableLoginSessions();
    mockRunnerState = {
      status: { state: 'ready', origin: 'http://127.0.0.1:5173' },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    const patchSpy = vi.spyOn(projectClient, 'patchProject').mockResolvedValue({
      ...mockProject,
      sessions: [
        { id: 1, label: 'Phiên 1' },
        { id: 2, label: 'Admin' },
      ],
    });

    render(<CanvasArea projectInfo={mockProject} trusted />);
    fireEvent.click(screen.getByTestId('session-select-trigger'));

    expect(screen.queryByTestId('session-delete-btn-1')).toBeNull();

    fireEvent.change(screen.getByTestId('session-add-input'), {
      target: { value: 'Admin' },
    });
    fireEvent.click(screen.getByTestId('session-add-btn'));

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith({
        sessions: [
          { id: 1, label: '1' },
          { id: 2, label: 'Admin' },
        ],
      });
    });
    expect(screen.getByTestId('session-delete-btn-2')).toBeDefined();
  });

  it('D4: when probing s2.localhost fails, keeps session 1 and shows browser *.localhost error message [WP-4.00]', async () => {
    enableLoginSessions();
    mockRunnerState = {
      status: { state: 'ready', origin: 'http://127.0.0.1:5173', nonce: 'n'.repeat(22) },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const projectWithTwoSessions: ProjectInfo = {
      ...mockProject,
      sessions: [
        { id: 1, label: 'Phiên 1' },
        { id: 2, label: 'Admin' },
      ],
    };
    render(<CanvasArea projectInfo={projectWithTwoSessions} trusted />);

    fireEvent.click(screen.getByTestId('session-select-trigger'));
    fireEvent.click(screen.getByTestId('session-item-2'));

    const errAlert = await screen.findByTestId('session-error');
    expect(errAlert.textContent).toBe(
      'Trình duyệt này không mở được địa chỉ *.localhost; dùng Chrome, Edge hoặc Firefox',
    );
    expect(screen.getByTestId('session-select-trigger').textContent).toBe('Đăng nhập: Phiên 1');
    expect(screen.getByTestId('canvas-iframe').getAttribute('src')).toBe('http://127.0.0.1:5173/');
  });
});
