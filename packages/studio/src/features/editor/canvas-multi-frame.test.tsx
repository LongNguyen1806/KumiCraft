// Tests for Canvas multi-frame layout and bridge routing (SPEC-04 M-MF, Phase 4 K9 chặng A).
import {
  DEFAULT_DESIGN_DIRS,
  type ElementRef,
  type ProjectInfo,
  type RunnerStatus,
} from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { useSettingsStore } from '../../store/settings-store.ts';
import { bridgeChannels, studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { CanvasArea } from './canvas-area.tsx';
import { useCanvasViewStore } from './canvas-view-store.ts';
import {
  defaultInitialOpenFrames,
  type OpenFrame,
  setStoredOpenFrames,
} from './open-frames-storage.ts';
import { resetSessionProbeCache } from './session-select.tsx';
import { StatusBar } from './status-bar.tsx';

const mockRunnerState: {
  status: RunnerStatus;
  logTail: string[];
  start: () => void;
  restart: () => void;
} = {
  status: { state: 'ready', origin: 'http://127.0.0.1:5173', nonce: 'testnonce123456789012' },
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
    { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
    { id: 'mobile', label: 'Mobile', width: 375, height: 667 },
  ],
  primaryFrameId: 'desktop',
  sessions: [
    { id: 1, label: 'Phiên 1' },
    { id: 2, label: 'Farmer' },
  ],
  backends: [],
  trusted: true,
  designDirs: DEFAULT_DESIGN_DIRS,
};

function enableLoginSessions() {
  useSettingsStore.setState({
    settings: { editor: 'vscode', agent: { preferred: 'auto' }, loginSessions: true },
  });
}

function resetTestStores() {
  localStorage.clear();
  resetSessionProbeCache();
  bridgeChannels.detachAll();
  useSelectionStore.getState().reset();
  useCanvasViewStore.setState({
    currentProjectId: undefined,
    openFrames: defaultInitialOpenFrames(),
    activeOpenFrameId: 'default',
  });
}

describe('CanvasMultiFrame [WP-4.00]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('vi');
  });

  beforeEach(() => {
    resetTestStores();
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
    resetTestStores();
  });

  it('[WP-4.00] A1: add mobile frame -> 2 iframes, each with its own nonce; studioBridgeChannel.select targets active frame; close frame to 1; cannot close last frame', () => {
    render(
      <div>
        <CanvasArea projectInfo={mockProject} trusted />
        <StatusBar trusted />
      </div>,
    );
    expect(screen.getAllByTestId('canvas-iframe')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('add-frame-btn'));
    fireEvent.click(screen.getByTestId('add-frame-item-mobile'));

    expect(screen.getAllByTestId('canvas-iframe')).toHaveLength(2);
    const store = useCanvasViewStore.getState();
    expect(store.openFrames).toHaveLength(2);
    const mobileFrameId = store.openFrames[1]?.id ?? '';
    expect(store.activeOpenFrameId).toBe(mobileFrameId);

    const activeChannel = bridgeChannels.get(mobileFrameId);
    const selectSpy = vi.spyOn(activeChannel, 'select');
    const testRef: ElementRef = { loc: 'src/App.tsx:10:5', index: 0 };
    studioBridgeChannel.select([testRef], false);
    expect(selectSpy).toHaveBeenCalledWith([testRef], false);

    const closeButtons = screen.getAllByTestId('close-frame-btn');
    expect(closeButtons).toHaveLength(2);
    const targetCloseBtn = closeButtons[1];
    if (targetCloseBtn) fireEvent.click(targetCloseBtn);

    expect(screen.getAllByTestId('canvas-iframe')).toHaveLength(1);
    const lastCloseBtn = screen.getByTestId('close-frame-btn');
    expect(lastCloseBtn.hasAttribute('disabled')).toBe(true);
    expect(lastCloseBtn.getAttribute('title')).toBe('Cần giữ lại ít nhất một khung');
  });

  it('[WP-4.00] A2: frame 1 session 1, frame 2 session 2 -> iframe 2 uses s2.localhost; messages from frame 2 do not leak to frame 1', async () => {
    enableLoginSessions();
    render(
      <div>
        <CanvasArea projectInfo={mockProject} trusted />
        <StatusBar trusted />
      </div>,
    );
    const frame2Id = useCanvasViewStore.getState().addOpenFrame('mobile', 2, '/farmer');
    expect(frame2Id).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByTestId('canvas-iframe')).toHaveLength(2);
    });

    const iframes = screen.getAllByTestId<HTMLIFrameElement>('canvas-iframe');
    expect(iframes[0]?.getAttribute('src')).toContain('http://localhost:5173');
    expect(iframes[1]?.getAttribute('src')).toContain('http://s2.localhost:5173');

    const ch2 = bridgeChannels.get(frame2Id ?? '');
    const channelWindow = window;
    ch2.attach(channelWindow, 'http://s2.localhost:5173', 'testnonce123456789012');

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://s2.localhost:5173',
        source: channelWindow,
        data: {
          rc: 1,
          nonce: 'testnonce123456789012',
          type: 'route',
          payload: { route: '/farmer-settings' },
        },
      }),
    );

    const frames = useCanvasViewStore.getState().openFrames;
    expect(frames[0]?.route).toBe('/');
    expect(frames[1]?.route).toBe('/farmer-settings');
  });

  it('[WP-4.00] A3: select element in frame 1 -> frame 2 with same route receives select with refs; frame 3 with different route does not receive', () => {
    useCanvasViewStore.setState({
      openFrames: [
        { id: 'f1', frameId: 'desktop', sessionId: 1, route: '/home' },
        { id: 'f2', frameId: 'mobile', sessionId: 1, route: '/home' },
        { id: 'f3', frameId: 'tablet', sessionId: 1, route: '/about' },
      ],
      activeOpenFrameId: 'f1',
    });

    const ch2 = bridgeChannels.get('f2');
    const ch3 = bridgeChannels.get('f3');
    const selectSpy2 = vi.spyOn(ch2, 'select');
    const selectSpy3 = vi.spyOn(ch3, 'select');

    const testRef: ElementRef = { loc: 'src/Home.tsx:5:3', index: 0 };
    studioBridgeChannel.select([testRef], false);

    expect(selectSpy2).toHaveBeenCalledWith([testRef], false);
    expect(selectSpy3).not.toHaveBeenCalled();
  });

  it('[WP-4.00] A4: select element in frame 2 -> frame 2 becomes active working frame, inspector reflects that element', () => {
    useCanvasViewStore.setState({
      openFrames: [
        { id: 'f1', frameId: 'desktop', sessionId: 1, route: '/home' },
        { id: 'f2', frameId: 'mobile', sessionId: 1, route: '/home' },
      ],
      activeOpenFrameId: 'f1',
    });

    const nonce = 'testnonce123456789012';
    const channelWindow = window;
    const ch2 = bridgeChannels.get('f2');
    ch2.attach(channelWindow, 'http://127.0.0.1:5173', nonce);

    const testRef: ElementRef = { loc: 'src/Button.tsx:12:4', index: 0 };
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://127.0.0.1:5173',
        source: channelWindow,
        data: {
          rc: 1,
          nonce,
          type: 'select',
          payload: { refs: [testRef] },
        },
      }),
    );

    expect(useCanvasViewStore.getState().activeOpenFrameId).toBe('f2');
    expect(useSelectionStore.getState().selectedRefs).toEqual([testRef]);
  });

  it('[WP-4.00] A5: layout persisted per project in localStorage; reload restores frames, sessions, routes; old data falls back to 1 frame', () => {
    const savedFrames: readonly OpenFrame[] = [
      { id: 'f1', frameId: 'desktop', sessionId: 1, route: '/products' },
      { id: 'f2', frameId: 'mobile', sessionId: 2, route: '/cart' },
    ];
    setStoredOpenFrames('shop000001', savedFrames);

    useCanvasViewStore.getState().initOpenFrames('shop000001', '/', 1);
    let store = useCanvasViewStore.getState();
    expect(store.openFrames).toHaveLength(2);
    expect(store.openFrames[0]?.route).toBe('/products');
    expect(store.openFrames[1]?.sessionId).toBe(2);

    localStorage.setItem('kumicraft.openFrames.shop000001', '{"corrupted": true}');
    useCanvasViewStore.setState({ currentProjectId: undefined });
    useCanvasViewStore.getState().initOpenFrames('shop000001', '/fallback-page', 1);

    store = useCanvasViewStore.getState();
    expect(store.openFrames).toHaveLength(1);
    expect(store.openFrames[0]?.frameId).toBe('desktop');
    expect(store.openFrames[0]?.route).toBe('/fallback-page');
    expect(store.openFrames[0]?.sessionId).toBe(1);
  });

  it('[WP-4.00] A6: max 4 frames -> add frame button disabled with tooltip reason', async () => {
    render(
      <div>
        <CanvasArea projectInfo={mockProject} trusted />
        <StatusBar trusted />
      </div>,
    );

    const store = useCanvasViewStore.getState();
    store.addOpenFrame('tablet');
    store.addOpenFrame('mobile');
    store.addOpenFrame('desktop');

    expect(useCanvasViewStore.getState().openFrames).toHaveLength(4);
    await waitFor(() => {
      expect(screen.getByTestId('add-frame-btn').hasAttribute('disabled')).toBe(true);
    });
    expect(screen.getByTestId('add-frame-btn').getAttribute('title')).toBe(
      'Tối đa 4 khung để đảm bảo hiệu năng',
    );

    const overflowId = useCanvasViewStore.getState().addOpenFrame('mobile');
    expect(overflowId).toBeUndefined();
    expect(useCanvasViewStore.getState().openFrames).toHaveLength(4);

    const fourthFrameId = useCanvasViewStore.getState().openFrames[3]?.id ?? '';
    useCanvasViewStore.getState().closeOpenFrame(fourthFrameId);

    expect(useCanvasViewStore.getState().openFrames).toHaveLength(3);
    await waitFor(() => {
      expect(screen.getByTestId('add-frame-btn').hasAttribute('disabled')).toBe(false);
    });
  });
});
