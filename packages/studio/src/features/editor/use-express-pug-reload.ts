// Reloads the Canvas iframe on template, public, or CSS edits for express-pug projects (SPEC-04 M-RN, Phase 4 K4).
import type { ProjectInfo } from '@kumicraft/shared';
import { useEffect, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';

function shouldReloadOn(file: string, viewsDir: string): boolean {
  const norm = file.replaceAll('\\', '/');
  return norm.startsWith(`${viewsDir}/`) || norm.startsWith('public/') || norm.endsWith('.css');
}

export function useExpressPugReload(project?: ProjectInfo): number {
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const isExpressPug = project?.support.framework === 'express-pug';
    if (!isExpressPug) return undefined;

    const viewsDir = (project.support.viewsDir ?? 'views')
      .replaceAll('\\', '/')
      .replace(/^\/+|\/+$/g, '');

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const client = createEventsClient({
      onEvent: (event: StudioServerEvent) => {
        if (event.type !== 'project.filesChanged') return;
        const payload = event.payload as { files?: readonly unknown[] } | undefined;
        const files = payload?.files;
        const stringFiles = Array.isArray(files)
          ? files.filter((f): f is string => typeof f === 'string')
          : [];
        const matches = stringFiles.some((f) => shouldReloadOn(f, viewsDir));
        if (!matches) return;

        if (debounceTimer !== undefined) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          setReloadTick((t) => t + 1);
        }, 300);
      },
    });

    return () => {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      client.close();
    };
  }, [project]);

  return reloadTick;
}
