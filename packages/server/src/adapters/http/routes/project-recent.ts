// Projects opened before, for the "no project is open" screen (R-PJ-25).
import type { RecentProject } from '@kumicraft/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import type { ConfigStore } from '../../../services/config/user-config.ts';
import { sendError } from '../send-error.ts';

const ForgetRecentSchema = z.strictObject({ path: z.string().min(1).max(4096) });

export type RecentProjectRoutesDeps = {
  readonly recents?: Pick<ConfigStore, 'recentProjects' | 'forgetProject'> | undefined;
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

  // The x on a row of the list: only the list changes, never the folder.
  api.post('/project/recent/forget', async (request, reply) => {
    const parsed = ForgetRecentSchema.safeParse(request.body);
    if (!parsed.success) return sendError(reply, { code: 'E016' });
    const res = await deps.recents?.forgetProject(parsed.data.path);
    if (res !== undefined && !res.ok) return sendError(reply, res.error);
    reply.status(204);
    return undefined;
  });
}
