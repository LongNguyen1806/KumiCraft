// Tests for offline Lucide Icon Picker & SVG sanitization (K9.7-2 Test 8).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IconPickerDialog } from './icon-picker.tsx';
import {
  buildIconJsx,
  type IconEntry,
  loadOfflineIcons,
  resetIconCacheForTest,
} from './icon-svg.ts';

afterEach(() => {
  cleanup();
  resetIconCacheForTest();
});

describe('Offline Lucide Icon Picker (K9.7-2 Test 8)', () => {
  it('contains >= 1000 icons with zero script/foreignObject tags', async () => {
    const icons = await loadOfflineIcons();
    expect(icons.length).toBeGreaterThanOrEqual(1000);
    for (const icon of icons) {
      expect(icon.name).toMatch(/^[a-z0-9-]+$/);
      expect(icon.node.length).toBeGreaterThan(0);
      for (const [tag] of icon.node) {
        expect(tag).not.toBe('script');
        expect(tag).not.toBe('foreignObject');
      }
    }
  });

  it('searches Vietnamese keyword "tim" -> heart and emits <svg data-icon="heart">', async () => {
    const onPick = vi.fn<(icon: IconEntry) => void>();
    const onClose = vi.fn();
    render(<IconPickerDialog open={true} onClose={onClose} onPick={onPick} />);

    const searchInput = await screen.findByTestId('icon-search');
    await screen.findByTestId('icon-item-activity');

    fireEvent.change(searchInput, { target: { value: 'tim' } });
    const heartBtn = await screen.findByTestId('icon-item-heart');
    fireEvent.click(heartBtn);

    expect(onPick).toHaveBeenCalledTimes(1);
    const picked = onPick.mock.calls[0]?.[0];
    expect(picked?.name).toBe('heart');
    if (picked === undefined) throw new Error('expected picked icon');
    const jsx = buildIconJsx(picked);
    expect(jsx).toContain('data-icon="heart"');
    expect(jsx).toContain('<svg');
    expect(jsx).not.toContain('<script');
  });
});
