// Directory browser endpoints (SPEC-03 section 5.1, S-27).
import type { DirectoryListing, DirectoryListingEntry } from '@kumicraft/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { DirectoryEntry, FileSystemPort } from '../../../core/ports/file-system-port.ts';
import { checkPathSyntax, parentPath } from '../../../core/shared/paths.ts';
import type { Platform } from '../../../core/shared/session.ts';
import { sendError } from '../send-error.ts';

export type FsRoutesDeps = {
  readonly fs: FileSystemPort;
  readonly platform: Platform;
  readonly homeDir: string;
};

const WINDOWS_DRIVE_CANDIDATES = ['C:/', 'D:/', 'E:/', 'F:/', 'G:/', 'H:/', 'Z:/'] as const;
const IGNORED_DIR_NAMES = ['node_modules', '$recycle.bin', 'system volume information'];

async function scanWindowsRoots(fs: FileSystemPort): Promise<string[]> {
  const activeRoots: string[] = [];
  for (const candidate of WINDOWS_DRIVE_CANDIDATES) {
    if (await fs.exists(candidate, '.')) {
      activeRoots.push(candidate);
    }
  }
  return activeRoots;
}

async function buildDirectoryEntries(
  rawPath: string,
  subdirs: readonly DirectoryEntry[],
  fs: FileSystemPort,
): Promise<DirectoryListingEntry[]> {
  return Promise.all(
    subdirs.map(async (entry) => {
      const fullSubPath = rawPath.endsWith('/')
        ? `${rawPath}${entry.name}`
        : `${rawPath}/${entry.name}`;
      const isProject = await fs.exists(fullSubPath, 'package.json');
      return {
        name: entry.name,
        path: fullSubPath,
        isProject,
      };
    }),
  );
}

async function handleGetDirectories(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: FsRoutesDeps,
): Promise<unknown> {
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
      !IGNORED_DIR_NAMES.includes(entry.name.toLowerCase()),
  );

  const truncated = subdirs.length > 1000 ? true : undefined;
  const entries = await buildDirectoryEntries(rawPath, subdirs.slice(0, 1000), deps.fs);
  const roots = deps.platform === 'win32' ? await scanWindowsRoots(deps.fs) : undefined;

  const listing: DirectoryListing = {
    path: rawPath.replaceAll('\\', '/'),
    parent: parentPath(rawPath),
    roots,
    entries,
    truncated,
  };

  return { data: listing };
}

export function registerFsRoutes(api: FastifyInstance, deps: FsRoutesDeps): void {
  api.get('/fs/directories', (request, reply) => handleGetDirectories(request, reply, deps));
}
