// The "dev port" field of the project dialog (R-RN-27).
import { DEFAULT_DESIGN_DIRS, type ProjectInfo } from '@reactcraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../api/project-client.ts';
import * as runnerClient from '../../api/runner-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { DevPortForm } from './dev-port-form.tsx';

const project: ProjectInfo = {
  id: 'shop000001',
  name: 'Shop',
  root: 'D:/work/shop',
  sourceDir: 'src',
  support: { supported: true, reasons: [], versions: {}, language: 'ts' },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  trusted: true,
  designDirs: DEFAULT_DESIGN_DIRS,
};

function mockSave() {
  const save = vi.spyOn(projectClient, 'saveDevPort').mockResolvedValue(project);
  const restart = vi.spyOn(runnerClient, 'restartRunner').mockResolvedValue({ state: 'starting' });
  return { save, restart };
}

describe('DevPortForm [R-RN-27]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('saves the picked port and restarts the dev server', async () => {
    const { save, restart } = mockSave();
    render(<DevPortForm />);

    fireEvent.change(screen.getByTestId('dev-port-input'), { target: { value: '3000' } });
    fireEvent.click(screen.getByTestId('dev-port-save'));

    await waitFor(() => {
      expect(restart).toHaveBeenCalledTimes(1);
    });
    expect(save).toHaveBeenCalledWith(3000);
  });

  it("an empty field goes back to the project's own port", async () => {
    const { save } = mockSave();
    render(<DevPortForm devPort={3000} />);
    expect(screen.getByTestId('dev-port-input')).toHaveProperty('value', '3000');

    fireEvent.change(screen.getByTestId('dev-port-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('dev-port-save'));

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith('auto');
    });
  });

  it('refuses a port outside 1024 to 65535 without saving', () => {
    const { save } = mockSave();
    render(<DevPortForm />);

    fireEvent.change(screen.getByTestId('dev-port-input'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('dev-port-save'));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText(/1024/)).toBeDefined();
  });
});
