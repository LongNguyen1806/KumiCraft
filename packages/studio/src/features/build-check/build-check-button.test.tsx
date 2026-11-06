// "Check build" in the status bar (K9 C, M-BC): the job runs, its result shows, a problem opens
// in the editor, and the file tree gets the red dot.
import type { BuildCheckResult, JobStatus } from '@kumicraft/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as editorClient from '../../api/editor-client.ts';
import * as jobsClient from '../../api/jobs-client.ts';
import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { BuildCheckButton, problemLoc } from './build-check-button.tsx';
import { useBuildCheckStore } from './build-check-store.ts';

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

function serverSends(type: string, payload: unknown): void {
  const data = JSON.stringify({ v: 1, type, at: '2026-11-07T08:00:01.000Z', payload });
  for (const socket of sockets) socket.onmessage?.({ data });
}

const FAILED: BuildCheckResult = {
  ok: false,
  total: 2,
  durationMs: 1200,
  problems: [
    { source: 'tsc', file: 'src/x.tsx', line: 3, column: 7, message: 'TS2322: Type mismatch' },
    { source: 'tsc', message: 'TS5083: Cannot read file tsconfig.base.json.' },
  ],
};

function jobStatus(result: BuildCheckResult): JobStatus {
  return {
    id: 'job1',
    kind: 'project.buildCheck',
    state: 'completed',
    result,
    startedAt: '2026-11-07T08:00:00.000Z',
  };
}

describe('BuildCheckButton [WP-4.00, M-BC]', () => {
  beforeAll(async () => {
    await initI18n();
    await i18next.changeLanguage('en');
  });

  beforeEach(() => {
    sockets = [];
    sessionStorage.setItem('kumicraft.sessionToken', 'token-test');
    vi.stubGlobal('WebSocket', FakeSocket);
    useBuildCheckStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('C1: runs the check as a job, lists file:line:col errors and opens one in the editor [WP-4.00]', async () => {
    const start = vi.spyOn(projectClient, 'startBuildCheck').mockResolvedValue({ jobId: 'job1' });
    vi.spyOn(jobsClient, 'fetchJob').mockResolvedValue(jobStatus(FAILED));
    const open = vi.spyOn(editorClient, 'openInEditor').mockResolvedValue(undefined);
    render(<BuildCheckButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Check build' }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Stop the check' })).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      serverSends('job.completed', { jobId: 'job1', kind: 'project.buildCheck' });
    });
    expect(await screen.findByTestId('build-check-panel')).toBeTruthy();
    expect(screen.getByTestId('build-check-result').textContent).toContain('2 build errors');
    const rows = screen.getAllByTestId('build-check-problem');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('src/x.tsx:3:7');
    // The error without a file is shown, but it is not a button.
    expect(screen.getByText('TS5083: Cannot read file tsconfig.base.json.')).toBeTruthy();

    fireEvent.click(rows[0] ?? document.body);
    expect(open).toHaveBeenCalledWith('src/x.tsx:3:7');
  });

  it('C1: a clean build says "Build OK" and keeps the panel closed [WP-4.00]', async () => {
    vi.spyOn(projectClient, 'startBuildCheck').mockResolvedValue({ jobId: 'job1' });
    vi.spyOn(jobsClient, 'fetchJob').mockResolvedValue(
      jobStatus({ ok: true, total: 0, durationMs: 900, problems: [] }),
    );
    render(<BuildCheckButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Check build' }));
    await screen.findByRole('button', { name: 'Stop the check' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      serverSends('job.completed', { jobId: 'job1', kind: 'project.buildCheck' });
    });
    expect((await screen.findByTestId('build-check-result')).textContent).toContain('Build OK');
    expect(screen.queryByTestId('build-check-panel') ?? undefined).toBeUndefined();
  });

  it('C3: a refused check (untrusted, E011) shows the reason instead of a result [WP-4.00]', async () => {
    const { ApiError } = await import('../../api/http.ts');
    vi.spyOn(projectClient, 'startBuildCheck').mockRejectedValue(
      new ApiError(403, 'E011', { reason: 'untrusted' }),
    );
    render(<BuildCheckButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Check build' }));
    expect((await screen.findByRole('alert')).textContent).toContain('could not run');
  });

  it('problemLoc gives the editor position, line 1 when the tool names none', () => {
    expect(problemLoc({ source: 'vite', file: 'src/a.ts', message: 'x' })).toBe('src/a.ts:1:1');
    expect(problemLoc({ source: 'tsc', message: 'x' })).toBeUndefined();
  });
});
