import { useEffect, useState } from 'react';

import { fetchProjectDirs } from '../../api/project-client.ts';

export function useDirSuggestions(): readonly string[] {
  const [dirs, setDirs] = useState<readonly string[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await fetchProjectDirs();
        if (active) setDirs(list);
      } catch {
        // Ignore directory fetch errors.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  return dirs;
}
