// Project data sources (TK-33, TK-34) and component props (TK-49) HTTP endpoints.
import * as nodePath from 'node:path';

import {
  ComponentPropsRequestSchema,
  DataSourceFieldsRequestSchema,
  issuesToDetails,
} from '@kumicraft/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';

import type { FileSystemPort } from '../../../core/ports/file-system-port.ts';
import type { ProcessPort } from '../../../core/ports/process-port.ts';
import { readComponentProps } from '../../../core/project/component-props-reader.ts';
import {
  listProjectDataSources,
  readProjectDataSourceFields,
} from '../../../core/project/data-sources/data-sources-service.ts';
import type { ProjectService } from '../../../core/project/project-service.ts';
import { sendError } from '../send-error.ts';

export type ProjectDataRoutesDeps = {
  readonly projectService: ProjectService;
  readonly fs?: FileSystemPort | undefined;
  readonly process?: ProcessPort | undefined;
  readonly tsInspectScript?: string | undefined;
};

function openProjectRootAndBackends(deps: ProjectDataRoutesDeps): {
  readonly root: string | undefined;
  readonly backendRoots: readonly string[];
  readonly trusted: boolean;
} {
  const ws = deps.projectService.state();
  if (ws.status !== 'open') return { root: undefined, backendRoots: [], trusted: false };
  const info = deps.projectService.getProjectInfo();
  const backends = info.ok ? info.value.backends : [];
  const backendRoots = backends
    .filter((b) => b.status === 'ok')
    .map((b) => nodePath.resolve(ws.root, b.path));
  return { root: ws.root, backendRoots, trusted: ws.trusted };
}

async function handleComponentPropsPost(
  deps: ProjectDataRoutesDeps,
  body: unknown,
  reply: FastifyReply,
) {
  const { root, trusted } = openProjectRootAndBackends(deps);
  if (!root || !deps.fs) return sendError(reply, { code: 'E001' });
  const parsed = ComponentPropsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
  }
  const result = await readComponentProps(
    readerDeps(deps.fs, deps, trusted),
    root,
    parsed.data.loc,
    parsed.data.tag,
    {
      ...(parsed.data.parentLoc !== undefined ? { parentLoc: parsed.data.parentLoc } : {}),
      ...(parsed.data.componentName !== undefined
        ? { componentName: parsed.data.componentName }
        : {}),
    },
  );
  if (!result.ok) return sendError(reply, result.error);
  return { data: result.value };
}

/**
 * Reading types runs the project's own TypeScript, so only a trusted project gets the child
 * process (S-80, like "Create component"); an untrusted one is read from the source text alone.
 */
export function readerDeps(
  fs: FileSystemPort,
  deps: Pick<ProjectDataRoutesDeps, 'process' | 'tsInspectScript'>,
  trusted: boolean,
) {
  return trusted
    ? { fs, process: deps.process, tsInspectScript: deps.tsInspectScript }
    : { fs, process: undefined, tsInspectScript: undefined };
}

export function registerProjectDataRoutes(api: FastifyInstance, deps: ProjectDataRoutesDeps): void {
  api.get('/project/data-sources', async (_request, reply) => {
    const { root, backendRoots, trusted } = openProjectRootAndBackends(deps);
    if (!root || !deps.fs) return sendError(reply, { code: 'E001' });
    const data = await listProjectDataSources(
      readerDeps(deps.fs, deps, trusted),
      root,
      backendRoots,
    );
    return { data };
  });

  api.post('/project/data-sources/fields', async (request, reply) => {
    const { root, backendRoots, trusted } = openProjectRootAndBackends(deps);
    if (!root || !deps.fs) return sendError(reply, { code: 'E001' });
    const parsed = DataSourceFieldsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, { code: 'E016', details: issuesToDetails(parsed.error.issues) });
    }
    const result = await readProjectDataSourceFields(
      readerDeps(deps.fs, deps, trusted),
      root,
      parsed.data,
      backendRoots,
    );
    if (!result.ok) return sendError(reply, result.error);
    return { data: result.value };
  });

  api.post('/project/component-props', async (request, reply) =>
    handleComponentPropsPost(deps, request.body, reply),
  );
}
