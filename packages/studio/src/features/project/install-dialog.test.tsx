// Unit tests for the install dialog following the install job (R-PJ-13, R-PJ-22).
import type { JobStatus } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as jobsClient from '../../api/jobs-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { InstallDialog } from './install-dialog.tsx';

let sockets: FakeSocket[] = [];

class FakeSocket {
  onopen: (() => void) | undefined = undefined;
  onmessage: ((event: { data: string }) => void) | undefined = undefined;
  onclose: (() => void) | undefined = undefined;
  onerror: (() => void) | undefined = undefined;

  constructor() {
    sockets.push(this);
    setTimeout(() => {
      this.onopen?.();
    }, 0);
  }

  close(): void {
    this.onclose?.();
  }
}

const JOB_ID = 'job000000001';

const runningStatus: JobStatus = {
  id: JOB_ID,
  kind: 'project.install',
  state: 'running',
  startedAt: '2026-10-16T08:00:00.000Z',
};

/** Sends a server event to every open socket, as the server's WebSocket does. */
function serverSends(type: string, payload: unknown): void {
  const data = JSON.stringify({ v: 1, type, at: '2026-10-16T08:00:01.000Z', payload });
  for (const socket of sockets) socket.onmessage?.({ data });
}

async function startInstall(): Promise<void> {
  render(
    <InstallDialog
      open
      installCommand={['pnpm', 'install']}
      onClose={vi.fn()}
      onInstalled={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByTestId('install-btn'));
  await vi.waitFor(() => {
    expect(jobsClient.fetchJob).toHaveBeenCalledWith(JOB_ID);
  });
}

describe('InstallDialog [R-PJ-22]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    sockets = [];
    sessionStorage.setItem('kumicraft.sessionToken', 'token-install');
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.spyOn(projectClient, 'installProject').mockResolvedValue({ jobId: JOB_ID });
    vi.spyOn(jobsClient, 'fetchJob').mockResolvedValue(runningStatus);
    vi.spyOn(jobsClient, 'cancelJob').mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the newest 20 lines of the install output [R-PJ-13]', async () => {
    await startInstall();
    const lines = Array.from({ length: 25 }, (_, i) => `line ${String(i + 1)}`);

    serverSends('job.progress', {
      jobId: JOB_ID,
      kind: 'project.install',
      done: 0,
      total: 0,
      lines: lines.slice(-20),
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId('install-logs').children).toHaveLength(20);
    });
    const shown = [...screen.getByTestId('install-logs').children].map((el) => el.textContent);
    expect(shown[0]).toBe('line 6');
    expect(shown[19]).toBe('line 25');
  });

  it('shows the translated E028 error with the package manager output [R-PJ-13]', async () => {
    await startInstall();

    serverSends('job.failed', {
      jobId: JOB_ID,
      kind: 'project.install',
      error: { code: 'E028', details: [{ message: 'ERR_PNPM_FETCH_404' }] },
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId('install-error').textContent).toContain('(E028)');
    });
    expect(screen.getByTestId('install-error').textContent).toContain('ERR_PNPM_FETCH_404');
    expect(screen.getByTestId('install-btn')).toBeDefined();
  });

  it('Cancel asks the server to cancel this job, and the dialog says it stopped [R-PJ-13]', async () => {
    await startInstall();

    fireEvent.click(screen.getByTestId('cancel-install-btn'));
    expect(jobsClient.cancelJob).toHaveBeenCalledWith(JOB_ID);

    serverSends('job.cancelled', { jobId: JOB_ID, kind: 'project.install' });
    await vi.waitFor(() => {
      expect(screen.getByTestId('install-cancelled')).toBeDefined();
    });
  });

  it('ignores events of another job', async () => {
    await startInstall();

    serverSends('job.failed', {
      jobId: 'other0000001',
      kind: 'project.install',
      error: { code: 'E028' },
    });
    serverSends('job.progress', {
      jobId: JOB_ID,
      kind: 'project.install',
      done: 0,
      total: 0,
      lines: ['still running'],
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId('install-logs').textContent).toContain('still running');
    });
    expect(screen.queryByTestId('install-error')).toBeNull();
  });
});
