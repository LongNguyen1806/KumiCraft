// Hook for loading and subscribing to project theme (R-IN-19, R-PJ-17).
import type { ThemeInfo } from '@reactcraft/shared';
import { useEffect, useRef, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { fetchProjectTheme } from '../../api/project-client.ts';

export const DEFAULT_THEME: ThemeInfo = {
  colors: [],
  fontSizes: [],
  radii: [],
  fonts: [],
  shadows: [],
  breakpoints: [],
};

export function useProjectTheme(): ThemeInfo {
  const [theme, setTheme] = useState<ThemeInfo>(DEFAULT_THEME);
  const themeRef = useRef<ThemeInfo>(DEFAULT_THEME);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await fetchProjectTheme();
        if (!cancelled) {
          themeRef.current = data;
          setTheme(data);
        }
      } catch {
        // Keep existing or DEFAULT_THEME
      }
    }

    void load();

    const client = createEventsClient({
      onEvent: (event: StudioServerEvent) => {
        if (event.type === 'project.changed') {
          void load();
        } else if (event.type === 'project.filesChanged') {
          if (
            event.payload &&
            typeof event.payload === 'object' &&
            'files' in event.payload &&
            Array.isArray(event.payload.files)
          ) {
            const currentFile = themeRef.current.file;
            if (currentFile !== undefined && event.payload.files.includes(currentFile)) {
              void load();
            }
          }
        }
      },
    });

    return () => {
      cancelled = true;
      client.close();
    };
  }, []);

  return theme;
}
