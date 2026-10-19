// Hook to fetch and keep project components up to date (SPEC-04 R-CP-12, spec-log #23).
import type { ProjectComponent } from '@reactcraft/shared';
import { useEffect } from 'react';
import { create } from 'zustand';

import { createEventsClient } from '../../api/events-client.ts';
import { isRecord } from '../../api/http.ts';
import { fetchComponents } from '../../api/project-client.ts';

const COMPONENT_FILE = /\.(tsx|jsx)$/;
const CONFIG_FILE = /(^|[\\/])\.reactcraft[\\/]components\.json$/;

function isRelevantFile(file: string): boolean {
  return COMPONENT_FILE.test(file) || CONFIG_FILE.test(file);
}

function handleEvent(
  event: { readonly type: string; readonly payload?: unknown },
  schedule: () => void,
): void {
  if (event.type === 'project.changed' || event.type === 'history.changed') {
    schedule();
    return;
  }
  if (event.type !== 'project.filesChanged') return;
  const files = isRecord(event.payload) ? event.payload['files'] : undefined;
  if (Array.isArray(files) && files.some((f) => typeof f === 'string' && isRelevantFile(f))) {
    schedule();
  }
}

export type ComponentsState = {
  readonly components: readonly ProjectComponent[];
  setComponents: (components: readonly ProjectComponent[]) => void;
};

export const useComponentsStore = create<ComponentsState>((set) => ({
  components: [],
  setComponents: (components) => {
    set({ components });
  },
}));

export function useProjectComponents(): readonly ProjectComponent[] {
  const components = useComponentsStore((s) => s.components);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetchComponents();
        if (active) useComponentsStore.getState().setComponents(res);
      } catch {
        if (active) useComponentsStore.getState().setComponents([]);
      }
    };

    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        void load();
      }, 300);
    };

    void load();
    const client = createEventsClient({
      onEvent: (event) => {
        handleEvent(event, schedule);
      },
    });

    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
      client.close();
    };
  }, []);

  return components;
}
