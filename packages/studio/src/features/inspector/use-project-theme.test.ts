import type { ThemeInfo } from '@reactcraft/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioServerEvent } from '../../api/events-client.ts';
import * as eventsClientModule from '../../api/events-client.ts';
import * as projectClientModule from '../../api/project-client.ts';
import { useProjectTheme } from './use-project-theme.ts';

describe('useProjectTheme', () => {
  let capturedOnEvent: ((event: StudioServerEvent) => void) | undefined;
  let closeSpy = vi.fn<() => void>();
  let fetchProjectThemeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capturedOnEvent = undefined;
    closeSpy = vi.fn<() => void>();

    vi.spyOn(eventsClientModule, 'createEventsClient').mockImplementation((options) => {
      capturedOnEvent = options?.onEvent;
      return {
        close: closeSpy,
        isConnected: () => true,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the project theme and reloads it when its CSS changes [R-IN-19, R-PJ-17]', async () => {
    const theme1: ThemeInfo = {
      file: 'src/index.css',
      colors: [{ name: 'brand', value: '#123456' }],
      fontSizes: [],
      radii: [],
      fonts: [],
      shadows: [],
      breakpoints: [],
    };

    const theme2: ThemeInfo = {
      file: 'src/index.css',
      colors: [
        { name: 'brand', value: '#123456' },
        { name: 'accent', value: '#654321' },
      ],
      fontSizes: [],
      radii: [],
      fonts: [],
      shadows: [],
      breakpoints: [],
    };

    fetchProjectThemeSpy = vi
      .spyOn(projectClientModule, 'fetchProjectTheme')
      .mockResolvedValueOnce(theme1)
      .mockResolvedValueOnce(theme2);

    const { result } = renderHook(() => useProjectTheme());

    await waitFor(() => {
      expect(result.current.colors).toEqual([{ name: 'brand', value: '#123456' }]);
    });
    expect(fetchProjectThemeSpy).toHaveBeenCalledTimes(1);

    // Event with other file -> does not trigger reload
    act(() => {
      capturedOnEvent?.({
        v: 1,
        type: 'project.filesChanged',
        at: new Date().toISOString(),
        payload: { files: ['src/App.tsx'] },
      });
    });

    expect(fetchProjectThemeSpy).toHaveBeenCalledTimes(1);

    // Event with theme.file -> triggers reload
    act(() => {
      capturedOnEvent?.({
        v: 1,
        type: 'project.filesChanged',
        at: new Date().toISOString(),
        payload: { files: ['src/index.css'] },
      });
    });

    await waitFor(() => {
      expect(result.current.colors).toHaveLength(2);
      expect(result.current.colors).toEqual([
        { name: 'brand', value: '#123456' },
        { name: 'accent', value: '#654321' },
      ]);
    });
    expect(fetchProjectThemeSpy).toHaveBeenCalledTimes(2);
  });
});
