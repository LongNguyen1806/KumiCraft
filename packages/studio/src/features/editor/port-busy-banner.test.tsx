// The warning shown when the Canvas could not run on the project's own port (R-RN-27).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as runnerClient from '../../api/runner-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { PortBusyBanner } from './port-busy-banner.tsx';

const ready = { state: 'ready', origin: 'http://127.0.0.1:52123', nonce: 'n'.repeat(22) } as const;

describe('PortBusyBanner [R-RN-27]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(() => {
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('names the busy port and restarts the dev server on request', async () => {
    vi.spyOn(runnerClient, 'fetchRunnerStatus').mockResolvedValue({ ...ready, busyPort: 5173 });
    const restart = vi.spyOn(runnerClient, 'restartRunner').mockResolvedValue(ready);
    render(<PortBusyBanner />);

    const banner = await screen.findByTestId('canvas-port-busy');
    expect(banner.textContent).toContain('5173');

    fireEvent.click(screen.getByTestId('canvas-port-busy-restart'));
    expect(restart).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByTestId('canvas-port-busy')).toBeNull();
    });
  });

  it("stays hidden when the Canvas runs on the project's port", async () => {
    const fetched = vi.spyOn(runnerClient, 'fetchRunnerStatus').mockResolvedValue(ready);
    render(<PortBusyBanner />);

    await waitFor(() => {
      expect(fetched).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('canvas-port-busy')).toBeNull();
  });
});
