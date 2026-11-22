// Component tests for InlineTextBar across Tailwind and plain CSS projects (K9.7-2 Test 3).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { InlineTextBar } from './inline-text-bar.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useProjectStore.setState({ project: undefined });
});

describe('InlineTextBar (K9.7-2 Test 3)', () => {
  beforeAll(async () => {
    await initI18n();
  });

  it('sends wrapText for Bold in Tailwind project and finishes session', async () => {
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:5:4'],
    });
    const onApplied = vi.fn();
    render(
      <InlineTextBar
        selection={{ ref: { loc: 'src/App.tsx:5:4', index: 0 }, tag: 'p', start: 6, end: 11 }}
        onApplied={onApplied}
      />,
    );

    fireEvent.click(screen.getByTestId('inline-text-bold'));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(spy.mock.calls[0]?.[0]).toEqual({
      kind: 'wrapText',
      loc: 'src/App.tsx:5:4',
      tag: 'p',
      start: 6,
      end: 11,
      wrapper: { tag: 'strong', className: 'font-semibold' },
    });
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('sends wrapText + css rule for Badge in plain CSS project', async () => {
    useProjectStore.setState({
      project: {
        id: 'css-app',
        name: 'css-app',
        root: '/tmp/css-app',
        sourceDir: 'src',
        support: {
          supported: true,
          framework: 'vite-react',
          versions: {},
          language: 'ts',
          styling: {
            systems: [{ id: 'css' }],
            primary: 'css',
            editable: false,
            globalCss: ['src/index.css'],
          },
          reasons: [],
        },
        needsInstall: false,
        responsiveMode: 'desktop-first',
        frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
        primaryFrameId: 'desktop',
        backends: [],
        trusted: true,
        designDirs: { pages: ['src/pages'], layouts: [], components: [], drafts: 'src/drafts' },
      },
    });
    const spy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:5:4'],
    });
    const onApplied = vi.fn();
    render(
      <InlineTextBar
        selection={{ ref: { loc: 'src/App.tsx:5:4', index: 0 }, tag: 'p', start: 0, end: 5 }}
        onApplied={onApplied}
      />,
    );

    fireEvent.click(screen.getByTestId('inline-text-badge'));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    const sentEdit = spy.mock.calls[0]?.[0];
    expect(sentEdit?.kind).toBe('wrapText');
    if (sentEdit?.kind === 'wrapText') {
      expect(sentEdit.wrapper).toEqual({ tag: 'span', className: 'kc-inline-badge' });
      expect(sentEdit.css?.rules[0]?.selector).toBe('.kc-inline-badge');
    }
  });
});
