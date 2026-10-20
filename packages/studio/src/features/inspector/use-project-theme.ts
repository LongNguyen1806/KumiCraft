// Store and hook for loading and subscribing to project theme (R-IN-19, R-PJ-17, R-TH-10).
import type { ThemeInfo } from '@reactcraft/shared';
import { useEffect } from 'react';
import { create } from 'zustand';

import {
  createEventsClient,
  type EventsClient,
  type StudioServerEvent,
} from '../../api/events-client.ts';
import { fetchProjectTheme } from '../../api/project-client.ts';

export const DEFAULT_THEME: ThemeInfo = {
  colors: [],
  fontSizes: [],
  radii: [],
  fonts: [],
  shadows: [],
  breakpoints: [],
};

export interface ThemeStoreState {
  readonly theme: ThemeInfo;
  readonly load: () => Promise<void>;
  readonly setTheme: (theme: ThemeInfo) => void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  theme: DEFAULT_THEME,
  load: async () => {
    try {
      const data = await fetchProjectTheme();
      set({ theme: data });
    } catch {
      // Keep existing or DEFAULT_THEME
    }
  },
  setTheme: (theme: ThemeInfo) => {
    set({ theme });
  },
}));

let subscriberCount = 0;
let activeClient: EventsClient | undefined;

function handleThemeServerEvent(event: StudioServerEvent): void {
  if (event.type === 'project.changed') {
    void useThemeStore.getState().load();
    return;
  }
  if (
    event.type === 'project.filesChanged' &&
    event.payload &&
    typeof event.payload === 'object' &&
    'files' in event.payload &&
    Array.isArray(event.payload.files)
  ) {
    const currentFile = useThemeStore.getState().theme.file;
    if (currentFile !== undefined && event.payload.files.includes(currentFile)) {
      void useThemeStore.getState().load();
    }
  }
}

export function useProjectTheme(): ThemeInfo {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    subscriberCount += 1;
    if (subscriberCount === 1) {
      void useThemeStore.getState().load();
      activeClient = createEventsClient({
        onEvent: handleThemeServerEvent,
      });
    }

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      if (subscriberCount === 0 && activeClient !== undefined) {
        activeClient.close();
        activeClient = undefined;
      }
    };
  }, []);

  return theme;
}
