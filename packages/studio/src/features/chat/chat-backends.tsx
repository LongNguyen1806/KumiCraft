// Project backend hook for chat panel (WP-3.05a, R-CH-07).
import type { BackendInfo } from '@kumicraft/shared';
import { useCallback, useEffect, useState } from 'react';

import { fetchProject } from '../../api/project-client.ts';
import { useProjectStore } from '../../core/project-store.ts';

export function useProjectBackends() {
  const [backends, setBackends] = useState<readonly BackendInfo[]>([]);

  const reload = useCallback(async () => {
    try {
      const project = await fetchProject();
      useProjectStore.getState().setProject(project);
      setBackends(project.backends);
    } catch {
      // Handled silently
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const project = await fetchProject();
        if (active) {
          useProjectStore.getState().setProject(project);
          setBackends(project.backends);
        }
      } catch {
        // Handled silently
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return { backends, reload };
}
