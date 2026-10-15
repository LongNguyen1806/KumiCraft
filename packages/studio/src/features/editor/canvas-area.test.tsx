import type { ProjectInfo, RunnerStatus } from '@reactcraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { initI18n } from '../../i18n/i18n.ts';
import { CanvasArea } from './canvas-area.tsx';

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
};

describe('CanvasArea', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders untrusted prompt when trusted is false', () => {
    const onTrust = vi.fn();
    render(<CanvasArea projectInfo={mockProject} trusted={false} onTrustRequest={onTrust} />);
    expect(screen.getByTestId('canvas-untrusted')).toBeDefined();
    const btn = screen.getByTestId('canvas-trust-btn');
    fireEvent.click(btn);
    expect(onTrust).toHaveBeenCalledTimes(1);
  });

  it('renders needs-install prompt when project needs install', () => {
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

  it('renders stopped view with run button when runner is stopped', () => {
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

  it('renders loading spinner when runner is starting', () => {
    mockRunnerState = {
      status: { state: 'starting' },
      logTail: [],
      start: vi.fn(),
      restart: vi.fn(),
    };
    render(<CanvasArea projectInfo={mockProject} trusted />);
    expect(screen.getByTestId('canvas-loading')).toBeDefined();
  });

  it('renders iframe when runner is ready', () => {
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

  it('renders error view with restart button when runner fails', () => {
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
});
