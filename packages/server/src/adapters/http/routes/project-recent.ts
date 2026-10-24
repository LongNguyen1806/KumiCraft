// Projects opened before, for the "no project is open" screen (R-PJ-25).
import type { RecentProject } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';

import type { FileSystemPort } from '../../../core/ports/file-system-port.ts';
import type { ConfigStore } from '../../../core/shared/user-config.ts';

export type RecentProjectRoutesDeps = {
  readonly recents?: Pick<ConfigStore, 'recentProjects'> | undefined;
  readonly fs?: FileSystemPort | undefined;
};

/** A folder moved or deleted since is left out; it stays in the config until it drops off. */
async function stillThere(fs: FileSystemPort | undefined, entry: RecentProject): Promise<boolean> {
  return fs === undefined || fs.exists(entry.path, '.kumicraft/workspace.json');
}

export function registerRecentProjectRoutes(
  api: FastifyInstance,
  deps: RecentProjectRoutesDeps,
): void {
  api.get('/project/recent', async () => {
    const all = deps.recents?.recentProjects() ?? [];
    const kept: RecentProject[] = [];
    for (const entry of all) {
      if (await stillThere(deps.fs, entry)) kept.push(entry);
    }
    return { data: kept };
  });
}
