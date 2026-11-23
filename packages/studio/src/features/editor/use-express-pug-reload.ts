// Reloads the Canvas iframe of projects whose dev server does not update the page itself:
// express-pug on template, public or CSS edits (SPEC-04 M-RN, Phase 4 K4), and ASP.NET when the
// runner says the page it serves changed (03c section 3.3).
import type { ProjectInfo } from '@kumicraft/shared';
import { useEffect, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';

function shouldReloadOn(file: string, viewsDir: string): boolean {
  const norm = file.replaceAll('\\', '/');
  return norm.startsWith(`${viewsDir}/`) || norm.startsWith('public/') || norm.endsWith('.css');
}

function changedFiles(event: StudioServerEvent): string[] {
  const payload = event.payload as { files?: readonly unknown[] } | undefined;
  const files = payload?.files;
  return Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string') : [];
}

/** Which events reload the Canvas of this project, if any. */
function reloadRule(project?: ProjectInfo): ((event: StudioServerEvent) => boolean) | undefined {
  const framework = project?.support.framework;
  if (framework === 'aspnet-razor-pages' || framework === 'aspnet-mvc') {
    return (event) => event.type === 'runner.pageChanged';
  }
  if (framework !== 'express-pug') return undefined;
  const viewsDir = (project?.support.viewsDir ?? 'views')
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '');
  // Express renders a view on each request: a KumiCraft edit, Undo or Redo (history.changed;
  // filesChanged is only for edits made outside KumiCraft) shows on the next load (03d 3.2).
  return (event) =>
    event.type === 'history.changed' ||
    (event.type === 'project.filesChanged' &&
      changedFiles(event).some((f) => shouldReloadOn(f, viewsDir)));
}

export function useExpressPugReload(project?: ProjectInfo): number {
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const rule = reloadRule(project);
    if (rule === undefined) return undefined;

    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const client = createEventsClient({
      onEvent: (event: StudioServerEvent) => {
        if (!rule(event)) return;
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
