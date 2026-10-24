// Server HTTP server creation and auto-open (SPEC-05 S-01, S-02).
import { resolveEnabledFeatures } from '@reactcraft/shared';
import type { FastifyInstance } from 'fastify';

import { createHttpApp } from './adapters/http/create-http-app.ts';
import type { FileSystemPort } from './core/ports/file-system-port.ts';
import type { ProjectService } from './core/project/project-service.ts';
import { ok, type Result } from './core/shared/result.ts';
import {
  createSessionInfoProvider,
  type SessionInfo,
  toSupportedPlatform,
} from './core/shared/session.ts';
import { createStyleService } from './core/style/style-service.ts';
import { createProjectReader } from './core/workspace/project-reader.ts';
import type { InitializedContext, StartServerOptions } from './index.ts';

export async function autoOpenProject(
  fs: FileSystemPort,
  projectService: ProjectService,
  workspaceDir?: string,
): Promise<Result<void>> {
  if (!workspaceDir) return ok(undefined);
  const hasWorkspace = await fs.exists(workspaceDir, '.reactcraft/workspace.json');
  if (hasWorkspace) {
    const opened = await projectService.open(workspaceDir);
    if (!opened.ok) {
      if (opened.error.code === 'E018') return opened;
      return ok(undefined);
    }
    return ok(undefined);
  }
  const probe = await projectService.probe(workspaceDir);
  if (probe.ok && probe.value.kind === 'project' && probe.value.support.supported) {
    const opened = await projectService.open(workspaceDir);
    if (!opened.ok) {
      if (opened.error.code === 'E018') return opened;
      return ok(undefined);
    }
  }
  return ok(undefined);
}

/** The AI chat and MCP endpoints (Phase 3). */
function agentRouteConfigs(ctx: InitializedContext) {
  const getProjectInfo = () => ctx.projectService.getProjectInfo();
  return {
    agentRoutes: { agentService: ctx.agentService, setupService: ctx.agentSetupService },
    agentTurnRoutes: { turnRunner: ctx.turnRunner, chatImages: ctx.chatImages, getProjectInfo },
    toolGapRoutes: { store: ctx.toolGapStore, getProjectInfo },
  };
}

function buildRouteConfigs(
  ctx: InitializedContext,
  getSessionInfo: () => SessionInfo,
  getProjectRoot: () => string | undefined,
  sessionToken: string,
) {
  return {
    projectRoutes: {
      projectService: ctx.projectService,
      getSessionInfo,
      fs: ctx.fs,
      usageCounter: ctx.usageCounter,
      recents: ctx.configStore,
    },
    runnerRoutes: { runnerService: ctx.runnerService },
    fsRoutes: { fs: ctx.fs, platform: ctx.platform, homeDir: ctx.homeDir },
    settingsRoutes: { config: ctx.configStore },
    eventRoutes: { eventBus: ctx.eventBus, sessionToken },
    sourceRoutes: {
      sourceEditorService: ctx.sourceEditorService,
      historyService: ctx.historyService,
      getProjectRoot,
      fs: ctx.fs,
    },
    styleRoutes: {
      styleService: createStyleService({ fs: ctx.fs }),
      projectService: ctx.projectService,
      fs: ctx.fs,
      sourceEditorService: ctx.sourceEditorService,
      historyService: ctx.historyService,
    },
    jobRoutes: { jobService: ctx.jobService },
    ...agentRouteConfigs(ctx),
    historyRoutes: {
      historyService: ctx.historyService,
      getProjectRoot,
    },
    editorRoutes: {
      fs: ctx.fs,
      process: ctx.processPort,
      platform: ctx.platform,
      editor: () => ctx.configStore.settings().editor,
      getProjectRoot,
    },
  };
}

export function createHttpServer(
  options: StartServerOptions,
  ctx: InitializedContext,
  sessionToken: string,
): Promise<FastifyInstance> {
  const getSessionInfo = createSessionInfoProvider({
    version: options.version,
    platform: toSupportedPlatform(process.platform) ?? 'linux',
    features: resolveEnabledFeatures(options.featureOverride),
    readProject: createProjectReader(ctx.projectService, options.workspaceDir),
  });

  const getProjectRoot = () => {
    const ws = ctx.projectService.state();
    return ws.status === 'open' ? ws.root : undefined;
  };

  const routes = buildRouteConfigs(ctx, getSessionInfo, getProjectRoot, sessionToken);

  return createHttpApp({
    logLevel: options.logLevel ?? 'info',
    security: { port: options.port, sessionToken, trustedOrigins: options.trustedOrigins ?? [] },
    getSessionInfo,
    ...routes,
    ...(options.studioDir === undefined ? {} : { studioDir: options.studioDir }),
  });
}
