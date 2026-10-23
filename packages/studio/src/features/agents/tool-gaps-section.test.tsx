// Settings → Missing tools (R-AG-20, round 7a).
import type { ToolGap } from '@reactcraft/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import * as toolGapsClient from '../../api/tool-gaps-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import { toolGapsMarkdown } from './tool-gaps-markdown.ts';
import { ToolGapsSection } from './tool-gaps-section.tsx';

const FIRST: ToolGap = {
  need: 'Set text color',
  why: 'No edit tool in 7a',
  example: 'h1 → text-red-600',
  count: 3,
  lastAt: '2026-10-23T10:00:00.000Z',
};

const GAPS: readonly ToolGap[] = [
  FIRST,
  {
    need: 'Insert section',
    why: 'Needed a hero',
    example: '',
    count: 1,
    lastAt: '2026-10-23T09:00:00.000Z',
  },
];

const LABELS = { title: 'Missing tools', why: 'Why', example: 'Example', last: 'Last seen' };

describe('Missing tools section [R-AG-20]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  beforeEach(async () => {
    await i18next.changeLanguage('vi');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists the gaps in the order the server gives, with counts and examples [R-AG-20]', async () => {
    vi.spyOn(toolGapsClient, 'fetchToolGaps').mockResolvedValue(GAPS);

    render(<ToolGapsSection open projectRoot="D:\work\shop" />);

    const first = await screen.findByTestId('tool-gap-0');
    expect(first.textContent).toContain('Set text color');
    expect(first.textContent).toContain('×3');
    expect(first.querySelector('.font-mono')?.textContent).toBe('h1 → text-red-600');
    expect(screen.getByTestId('tool-gap-1').textContent).toContain('×1');
  });

  it('says there is nothing yet and shows how to connect Claude Code [R-AG-20]', async () => {
    vi.spyOn(toolGapsClient, 'fetchToolGaps').mockResolvedValue([]);

    render(<ToolGapsSection open projectRoot="D:\work\shop" />);

    expect(await screen.findByTestId('tool-gaps-empty')).toBeDefined();
    expect(screen.getByTestId('tool-gaps').textContent).toContain(
      String.raw`claude mcp add reactcraft -- npx reactcraft mcp "D:\work\shop"`,
    );
    expect(screen.getByTestId<HTMLButtonElement>('tool-gaps-export').disabled).toBe(true);
  });

  it('loads when the dialog opens and again on refresh [R-AG-20]', async () => {
    const fetchSpy = vi.spyOn(toolGapsClient, 'fetchToolGaps').mockResolvedValue([]);

    const { rerender } = render(<ToolGapsSection open={false} projectRoot="D:\work\shop" />);
    expect(fetchSpy).not.toHaveBeenCalled();
    rerender(<ToolGapsSection open projectRoot="D:\work\shop" />);
    await screen.findByTestId('tool-gaps-empty');
    fireEvent.click(screen.getByTestId('tool-gaps-refresh'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('exports the gaps as a Markdown file [R-AG-20]', async () => {
    vi.spyOn(toolGapsClient, 'fetchToolGaps').mockResolvedValue(GAPS);
    const blobs: Blob[] = [];
    const create = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:tool-gaps';
    });
    const original = {
      create: URL.createObjectURL.bind(URL),
      revoke: URL.revokeObjectURL.bind(URL),
    };
    URL.createObjectURL = create;
    URL.revokeObjectURL = vi.fn();
    onTestFinished(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<ToolGapsSection open projectRoot="D:\work\shop" />);
    await screen.findByTestId('tool-gap-0');
    fireEvent.click(screen.getByTestId('tool-gaps-export'));

    expect(click).toHaveBeenCalledTimes(1);
    expect(blobs[0]?.type).toBe('text/markdown');
    const text = await blobs[0]?.text();
    expect(text).toContain('## Set text color (×3)');
    expect(text).toContain('h1 → text-red-600');
  });
});

describe('toolGapsMarkdown [R-AG-20]', () => {
  it('writes one section per gap and fences examples that contain backticks [R-AG-20]', () => {
    const md = toolGapsMarkdown(
      [{ ...FIRST, example: 'use ```code``` here' }],
      LABELS,
      new Date('2026-10-23T12:00:00.000Z'),
    );

    expect(md.startsWith('# Missing tools\n\n2026-10-23\n')).toBe(true);
    expect(md).toContain('## Set text color (×3)');
    expect(md).toContain('````\nuse ```code``` here\n````');
  });
});
