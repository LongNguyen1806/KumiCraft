// Directory browser endpoints (SPEC-03 section 5.1, S-27).
import type { DirectoryListing, DirectoryListingEntry } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';

import type { FileSystemPort } from '../../../core/ports/file-system-port.ts';
import { checkPathSyntax, parentPath } from '../../../core/shared/paths.ts';
import type { Platform } from '../../../core/shared/session.ts';
import { sendError } from '../send-error.ts';

export type FsRoutesDeps = {
  readonly fs: FileSystemPort;
  readonly platform: Platform;
  readonly homeDir: string;
};

const WINDOWS_DRIVE_CANDIDATES = ['C:/', 'D:/', 'E:/', 'F:/', 'G:/', 'H:/', 'Z:/'] as const;

export function registerFsRoutes(api: FastifyInstance, deps: FsRoutesDeps): void {
  api.get('/fs/directories', async (request, reply) => {
    const query = request.query as { path?: string };
    const rawPath = query.path && query.path.trim().length > 0 ? query.path : deps.homeDir;

    const syntaxErr = checkPathSyntax(rawPath, deps.platform);
    if (syntaxErr !== undefined) {
      return sendError(reply, syntaxErr);
    }

    const readResult = await deps.fs.readDir(rawPath, '.');
    if (!readResult.ok) {
      return sendError(reply, readResult.error);
    }

    const subdirs = readResult.value.filter(
      (entry) =>
        entry.kind === 'directory' &&
        !entry.name.startsWith('.') &&
        !['node_modules', '$recycle.bin', 'system volume information'].includes(
          entry.name.toLowerCase(),
        ),
    );

    const truncated = subdirs.length > 1000 ? true : undefined;
    const limited = subdirs.slice(0, 1000);

    const entries: DirectoryListingEntry[] = await Promise.all(
      limited.map(async (entry) => {
        const fullSubPath = rawPath.endsWith('/')
          ? `${rawPath}${entry.name}`
          : `${rawPath}/${entry.name}`;
        const isProject = await deps.fs.exists(fullSubPath, 'package.json');
        return {
          name: entry.name,
          path: fullSubPath,
          isProject,
        };
      }),
    );

    let roots: string[] | undefined;
    if (deps.platform === 'win32') {
      const activeRoots: string[] = [];
      for (const candidate of WINDOWS_DRIVE_CANDIDATES) {
        if (await deps.fs.exists(candidate, '.')) {
          activeRoots.push(candidate);
        }
      }
      roots = activeRoots;
    }

    const listing: DirectoryListing = {
      path: rawPath.replaceAll('\\', '/'),
      parent: parentPath(rawPath),
      roots,
      entries,
      truncated,
    };

    return { data: listing };
  });
}
