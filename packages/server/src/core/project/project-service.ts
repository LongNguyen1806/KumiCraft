// Project lifecycle, framework detection, creation, installation, backends, theme (SPEC-04 M-PJ).
import {
  type BackendInfo,
  type Frame,
  type PackageManager,
  type ProjectInfo,
  type ProjectProbe,
  type ResponsiveMode,
  serializeWorkspaceFile,
  type SupportReport,
  type ThemeInfo,
  WORKSPACE_FILE,
  type WorkspaceFile,
} from '@reactcraft/shared';

import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import { type AppError, err, ok, type Result } from '../shared/result.ts';
import type { Platform } from '../shared/session.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import { acquireLock, type LockInfo, releaseLock } from '../workspace/lock.ts';
import { rememberPort } from '../workspace/studio-port.ts';
import { trustKeyOf } from '../workspace/trust.ts';
import { createProject } from './create.ts';
import { probeProject } from './probe.ts';
import {
  computeBackendInfos,
  executeAddBackend,
  executeRemoveBackend,
} from './project-backends.ts';
import { checkNeedsInstall, getInstallCommand, runProjectInstall } from './project-install.ts';
import { loadOrCreateWorkspaceFile } from './project-workspace-file.ts';
import { readThemeTokens } from './theme.ts';

export type WorkspaceState =
  | { readonly status: 'none'; readonly suggestedPath?: string | undefined }
  | {
      readonly status: 'open';
      readonly root: string;
      readonly file: WorkspaceFile;
      readonly support: SupportReport;
      readonly trusted: boolean;
      readonly needsInstall: boolean;
      readonly backends: readonly BackendInfo[];
    }
  | { readonly status: 'error'; readonly error: AppError; readonly root: string };

export type ProjectServiceDeps = {
  readonly fs: FileSystemPort;
  readonly system: SystemPort;
  readonly process: ProcessPort;
  readonly config: Pick<ConfigStore, 'isTrusted' | 'setTrusted' | 'settings'>;
  readonly logger: LoggerPort;
  readonly eventBus?: EventBusPort | undefined;
  readonly port: number;
  readonly platform: Platform;
  readonly homeDir?: string | undefined;
  readonly templateDir: string;
  readonly initialRoot?: string | undefined;
  readonly runnerService?: { start(): Promise<unknown>; stop(): Promise<unknown> } | undefined;
};

export type ProjectService = {
  state(): WorkspaceState;
  probe(path: string): Promise<Result<ProjectProbe>>;
  open(path?: string): Promise<Result<ProjectInfo>>;
  create(path: string, name: string, packageManager?: PackageManager): Promise<Result<ProjectInfo>>;
  close(): Promise<void>;
  getProjectInfo(): Result<ProjectInfo>;
  patchProject(updates: {
    readonly name?: string | undefined;
    readonly responsiveMode?: ResponsiveMode | undefined;
    readonly frames?: readonly Frame[] | undefined;
    readonly primaryFrameId?: string | undefined;
  }): Promise<Result<ProjectInfo>>;
  setTrusted(trusted: boolean): Promise<Result<ProjectInfo>>;
  install(command: readonly string[]): Promise<Result<void>>;
  theme(): Promise<Result<ThemeInfo>>;
  addBackend(path: string, label?: string): Promise<Result<BackendInfo>>;
  removeBackend(id: string): Promise<Result<void>>;
};

function normalizeRoot(path: string, platform: Platform): string {
  const unified = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'linux' ? unified : unified.toLowerCase();
}

function buildProjectInfo(
  root: string,
  file: WorkspaceFile,
  support: SupportReport,
  trusted: boolean,
  needsInstall: boolean,
  backends: readonly BackendInfo[],
): ProjectInfo {
  return {
    id: file.id,
    name: file.name,
    root,
    sourceDir: file.sourceDir,
    support,
    needsInstall,
    installCommand: getInstallCommand(support.packageManager),
    responsiveMode: file.responsiveMode,
    frames: file.frames,
    primaryFrameId: file.primaryFrameId,
    backends,
    trusted,
  };
}

class ProjectServiceImpl implements ProjectService {
  private current: WorkspaceState;
  private heldLock: { root: string; info: LockInfo } | undefined;
  private readonly createdPackageManagers = new Map<string, PackageManager>();
  private readonly deps: ProjectServiceDeps;

  constructor(deps: ProjectServiceDeps) {
    this.deps = deps;
    this.current = deps.initialRoot
      ? { status: 'none', suggestedPath: deps.initialRoot }
      : { status: 'none' };
  }

  state(): WorkspaceState {
    return this.current;
  }

  async probe(path: string): Promise<Result<ProjectProbe>> {
    return probeProject(path, {
      fs: this.deps.fs,
      platform: this.deps.platform,
      homeDir: this.deps.homeDir,
    });
  }

  private resolveOpenSupport(root: string, baseSupport: SupportReport): SupportReport {
    if (baseSupport.packageManager !== undefined) return baseSupport;
    const fromCreated = this.createdPackageManagers.get(normalizeRoot(root, this.deps.platform));
    const resolvedPm = fromCreated ?? this.deps.config.settings().packageManager;
    return resolvedPm !== undefined ? { ...baseSupport, packageManager: resolvedPm } : baseSupport;
  }

  private async releaseCurrentLock(): Promise<void> {
    if (this.heldLock !== undefined) {
      await releaseLock(this.deps.fs, this.heldLock.root, this.heldLock.info);
      this.heldLock = undefined;
    }
  }

  /** Probes the folder; anything but a supported project is E001 (R-PJ-07). */
  private async probeSupported(root: string): Promise<Result<SupportReport>> {
    const probed = await probeProject(root, {
      fs: this.deps.fs,
      platform: this.deps.platform,
      homeDir: this.deps.homeDir,
    });
    if (!probed.ok) return probed;
    if (probed.value.kind !== 'project') {
      return err({ code: 'E001', params: { reasons: ['noPackageJson'] } });
    }
    if (!probed.value.support.supported) {
      return err({ code: 'E001', params: { reasons: probed.value.support.reasons } });
    }
    return ok(probed.value.support);
  }

  async open(targetPath?: string): Promise<Result<ProjectInfo>> {
    const root =
      targetPath ?? (this.current.status === 'open' ? this.current.root : this.deps.initialRoot);
    if (!root) {
      return err({ code: 'E021', params: { missing: 'project' } });
    }

    const probed = await this.probeSupported(root);
    if (!probed.ok) return probed;

    const support = this.resolveOpenSupport(root, probed.value);
    if (this.heldLock !== undefined) {
      await this.releaseCurrentLock();
    }

    const lockTaken = await acquireLock(this.deps.fs, root, this.deps.system, this.deps.port);
    if (!lockTaken.ok) return lockTaken;
    this.heldLock = { root, info: lockTaken.value };
    await rememberPort(this.deps.fs, root, this.deps.port);

    const fileRes = await loadOrCreateWorkspaceFile(this.deps, root, support);
    if (!fileRes.ok) {
      this.current = { status: 'error', error: fileRes.error, root };
      this.deps.eventBus?.publish('session.changed', undefined);
      return fileRes;
    }
    const file = fileRes.value;

    const trusted = this.deps.config.isTrusted(trustKeyOf(file, root));
    const needsInstall = await checkNeedsInstall(this.deps.fs, root);
    const backends = await computeBackendInfos(
      this.deps.fs,
      root,
      file,
      this.deps.platform,
      this.deps.homeDir,
    );

    this.current = { status: 'open', root, file, support, trusted, needsInstall, backends };
    const info = buildProjectInfo(root, file, support, trusted, needsInstall, backends);
    this.deps.eventBus?.publish('session.changed', undefined);
    this.deps.eventBus?.publish('project.changed', info);
    if (trusted && !needsInstall && support.supported) {
      void this.deps.runnerService?.start();
    }
    return ok(info);
  }

  async create(
    path: string,
    name: string,
    packageManager?: PackageManager,
  ): Promise<Result<ProjectInfo>> {
    const created = await createProject(path, name, {
      fs: this.deps.fs,
      platform: this.deps.platform,
      templateDir: this.deps.templateDir,
      homeDir: this.deps.homeDir,
    });
    if (!created.ok) return created;
    if (packageManager !== undefined) {
      this.createdPackageManagers.set(normalizeRoot(path, this.deps.platform), packageManager);
    }
    return this.open(path);
  }

  async close(): Promise<void> {
    await this.deps.runnerService?.stop();
    await this.releaseCurrentLock();
    this.current = { status: 'none' };
    this.deps.eventBus?.publish('session.changed', undefined);
  }

  getProjectInfo(): Result<ProjectInfo> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    return ok(
      buildProjectInfo(
        this.current.root,
        this.current.file,
        this.current.support,
        this.current.trusted,
        this.current.needsInstall,
        this.current.backends,
      ),
    );
  }

  async patchProject(updates: {
    readonly name?: string | undefined;
    readonly responsiveMode?: ResponsiveMode | undefined;
    readonly frames?: readonly Frame[] | undefined;
    readonly primaryFrameId?: string | undefined;
  }): Promise<Result<ProjectInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }

    const updatedFile: WorkspaceFile = {
      ...this.current.file,
      name: updates.name ?? this.current.file.name,
      responsiveMode: updates.responsiveMode ?? this.current.file.responsiveMode,
      frames: updates.frames ? [...updates.frames] : this.current.file.frames,
      primaryFrameId: updates.primaryFrameId ?? this.current.file.primaryFrameId,
    };

    const write = await this.deps.fs.writeTextAtomic(
      this.current.root,
      WORKSPACE_FILE,
      serializeWorkspaceFile(updatedFile),
    );
    if (!write.ok) return write;

    this.current = { ...this.current, file: updatedFile };
    const info = buildProjectInfo(
      this.current.root,
      updatedFile,
      this.current.support,
      this.current.trusted,
      this.current.needsInstall,
      this.current.backends,
    );
    this.deps.eventBus?.publish('project.changed', info);
    return ok(info);
  }

  async setTrusted(trusted: boolean): Promise<Result<ProjectInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }

    const saved = await this.deps.config.setTrusted(
      trustKeyOf(this.current.file, this.current.root),
      trusted,
    );
    if (!saved.ok) return saved;

    this.current = { ...this.current, trusted };
    const info = buildProjectInfo(
      this.current.root,
      this.current.file,
      this.current.support,
      trusted,
      this.current.needsInstall,
      this.current.backends,
    );
    this.deps.eventBus?.publish('session.changed', undefined);
    this.deps.eventBus?.publish('project.changed', info);
    if (trusted && !this.current.needsInstall && this.current.support.supported) {
      void this.deps.runnerService?.start();
    }
    return ok(info);
  }

  async install(command: readonly string[]): Promise<Result<void>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    if (!this.current.trusted) {
      return err({ code: 'E011', params: { path: this.current.root, reason: 'untrusted' } });
    }
    if (!this.current.support.packageManager) {
      return err({ code: 'E021', params: { missing: 'packageManager' } });
    }

    const expectedCommand = getInstallCommand(this.current.support.packageManager);
    const installRes = await runProjectInstall(
      this.deps.process,
      this.current.root,
      command,
      expectedCommand,
    );
    if (!installRes.ok) return installRes;

    const needsInstall = await checkNeedsInstall(this.deps.fs, this.current.root);
    this.current = { ...this.current, needsInstall };
    const info = buildProjectInfo(
      this.current.root,
      this.current.file,
      this.current.support,
      this.current.trusted,
      needsInstall,
      this.current.backends,
    );
    this.deps.eventBus?.publish('project.changed', info);
    if (!needsInstall && this.current.trusted && this.current.support.supported) {
      void this.deps.runnerService?.start();
    }
    return ok(undefined);
  }

  async theme(): Promise<Result<ThemeInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    if (!this.current.support.tailwindCss) {
      return ok({
        colors: [],
        fontSizes: [],
        radii: [],
        fonts: [],
        shadows: [],
        breakpoints: [],
      });
    }
    return readThemeTokens(this.deps.fs, this.current.root, this.current.support.tailwindCss);
  }

  async addBackend(backendPath: string, customLabel?: string): Promise<Result<BackendInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }

    const res = await executeAddBackend(
      this.deps,
      this.current.root,
      this.current.file,
      this.current.trusted,
      backendPath,
      customLabel,
    );
    if (!res.ok) return res;

    this.current = { ...this.current, file: res.value.updatedFile, backends: res.value.backends };
    this.deps.eventBus?.publish(
      'project.changed',
      buildProjectInfo(
        this.current.root,
        res.value.updatedFile,
        this.current.support,
        this.current.trusted,
        this.current.needsInstall,
        res.value.backends,
      ),
    );
    return ok(res.value.added);
  }

  async removeBackend(id: string): Promise<Result<void>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }

    const res = await executeRemoveBackend(
      this.deps,
      this.current.root,
      this.current.file,
      this.current.trusted,
      id,
    );
    if (!res.ok) return res;

    this.current = { ...this.current, file: res.value.updatedFile, backends: res.value.backends };
    this.deps.eventBus?.publish(
      'project.changed',
      buildProjectInfo(
        this.current.root,
        res.value.updatedFile,
        this.current.support,
        this.current.trusted,
        this.current.needsInstall,
        res.value.backends,
      ),
    );
    return ok(undefined);
  }
}

export function createProjectService(deps: ProjectServiceDeps): ProjectService {
  return new ProjectServiceImpl(deps);
}
