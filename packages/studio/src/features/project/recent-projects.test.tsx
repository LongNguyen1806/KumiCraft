// @vitest-environment happy-dom
import type { ProjectInfo } from '@kumicraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as projectClient from '../../api/project-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { RecentProjects } from './recent-projects.tsx';

const SHOP: ProjectInfo = {
  id: 'shop000001',
  name: 'Shop',
  root: 'D:/work/shop',
  sourceDir: 'src',
  support: { supported: true, reasons: [], framework: 'vite-react', versions: {}, language: 'ts' },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  designDirs: {
    pages: ['src/pages'],
    layouts: ['src/layouts'],
    components: ['src/components'],
    drafts: 'src/drafts',
  },
  trusted: true,
};

describe('RecentProjects [R-PJ-25]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists the recent projects and opens one with a single click', async () => {
    vi.spyOn(projectClient, 'fetchRecentProjects').mockResolvedValue([
      { path: 'D:/work/shop', name: 'Shop', openedAt: '2026-10-24T01:00:00.000Z' },
    ]);
    const open = vi.spyOn(projectClient, 'openProject').mockResolvedValue(SHOP);
    const onOpened = vi.fn();

    render(<RecentProjects onOpened={onOpened} />);
    const item = await screen.findByTestId('recent-project-0');
    expect(item.textContent).toContain('Shop');
    expect(item.textContent).toContain('D:/work/shop');
    fireEvent.click(item);

    await waitFor(() => {
      expect(onOpened).toHaveBeenCalled();
    });
    expect(open).toHaveBeenCalledWith('D:/work/shop');
  });

  it('shows nothing when no project was opened before', async () => {
    const fetch = vi.spyOn(projectClient, 'fetchRecentProjects').mockResolvedValue([]);

    render(<RecentProjects onOpened={vi.fn()} />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('recent-projects')).toBeNull();
  });
});
