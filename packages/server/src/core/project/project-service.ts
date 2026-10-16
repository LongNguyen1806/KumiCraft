// Project lifecycle, framework detection, creation, installation, backends, theme (SPEC-04 M-PJ).
import {
  type BackendInfo,
  type BackendLink,
  type Frame,
  newWorkspaceFile,
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
import { nanoid } from 'nanoid';

import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import {
  checkBlockedPath,
  checkPathSyntax,
  isInside,
  parentPath,
  resolveBackendPath,
  toStoredBackendPath,
} from '../shared/paths.ts';
import { type AppError, err, ok, type Result } from '../shared/result.ts';
import type { Platform } from '../shared/session.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import { acquireLock, type LockInfo, releaseLock } from '../workspace/lock.ts';
import { readWorkspaceFile } from '../workspace/read-workspace.ts';
import { rememberPort } from '../workspace/studio-port.ts';
import { trustKeyOf } from '../workspace/trust.ts';
import { createProject } from './create.ts';
import { detectResponsiveMode } from './detect-responsive.ts';
import { probeProject } from './probe.ts';
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

export function createProjectService(deps: ProjectServiceDeps): ProjectService {
  let current: WorkspaceState = deps.initialRoot
    ? { status: 'none', suggestedPath: deps.initialRoot }
    : { status: 'none' };
  let heldLock: { root: string; info: LockInfo } | undefined;
  const createdPackageManagers = new Map<string, PackageManager>();

  async function checkNeedsInstall(root: string): Promise<boolean> {
    const hasVite = await deps.fs.exists(root, 'node_modules/vite/package.json');
    const hasReact = await deps.fs.exists(root, 'node_modules/react/package.json');
    return !hasVite || !hasReact;
  }

  function getInstallCommand(pm?: PackageManager): string[] | undefined {
    if (pm === 'pnpm') return ['pnpm', 'install'];
    if (pm === 'npm') return ['npm', 'install'];
    if (pm === 'yarn') return ['yarn', 'install'];
    return undefined;
  }

  async function toBackendInfo(
    root: string,
    link: BackendLink,
    platform: Platform,
    homeDir?: string,
  ): Promise<BackendInfo> {
    const resolvedPath = resolveBackendPath(root, link.path);
    const parent = parentPath(root);
    const outsideParent =
      parent === undefined
        ? !isInside(root, resolvedPath, platform)
        : !isInside(parent, resolvedPath, platform);
    const blocked = checkBlockedPath(resolvedPath, platform, homeDir);
    if (blocked !== undefined) {
      return { ...link, status: 'blocked', resolvedPath, outsideParent };
    }
    const exists = await deps.fs.exists(resolvedPath, '.');
    if (!exists) {
      return { ...link, status: 'missing', resolvedPath, outsideParent };
    }
    return { ...link, status: 'ok', resolvedPath, outsideParent };
  }

  async function computeBackendInfos(
    root: string,
    file: WorkspaceFile,
    platform: Platform,
    homeDir?: string,
  ): Promise<BackendInfo[]> {
    return Promise.all(file.backends.map((b) => toBackendInfo(root, b, platform, homeDir)));
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

  const releaseCurrentLock = async () => {
    if (heldLock !== undefined) {
      await releaseLock(deps.fs, heldLock.root, heldLock.info);
      heldLock = undefined;
    }
  };

  return {
    state: () => current,

    async probe(path: string): Promise<Result<ProjectProbe>> {
      return probeProject(path, {
        fs: deps.fs,
        platform: deps.platform,
        homeDir: deps.homeDir,
      });
    },

    async open(targetPath?: string): Promise<Result<ProjectInfo>> {
      const root = targetPath ?? (current.status === 'open' ? current.root : deps.initialRoot);
      if (!root) {
        return err({ code: 'E021', params: { missing: 'project' } });
      }

      // R-PJ-07: only a supported project opens, whether or not it has a workspace.json yet. Its
      // dev server runs the project's own code, so an unsupported folder never gets that far.
      const probed = await probeProject(root, {
        fs: deps.fs,
        platform: deps.platform,
        homeDir: deps.homeDir,
      });
      if (!probed.ok) return probed;
      if (probed.value.kind !== 'project') {
        return err({ code: 'E001', params: { reasons: ['noPackageJson'] } });
      }
      if (!probed.value.support.supported) {
        return err({ code: 'E001', params: { reasons: probed.value.support.reasons } });
      }
      let support: SupportReport = probed.value.support;
      if (support.packageManager === undefined) {
        const fromCreated = createdPackageManagers.get(normalizeRoot(root, deps.platform));
        const resolvedPm = fromCreated ?? deps.config.settings().packageManager;
        if (resolvedPm !== undefined) {
          support = { ...support, packageManager: resolvedPm };
        }
      }

      // Close previous if already holding a lock
      if (heldLock !== undefined) {
        await releaseCurrentLock();
      }

      // 2. Acquire lock
      const lockTaken = await acquireLock(deps.fs, root, deps.system, deps.port);
      if (!lockTaken.ok) return lockTaken;
      heldLock = { root, info: lockTaken.value };
      await rememberPort(deps.fs, root, deps.port);

      // 3. Read or create workspace.json
      let file: WorkspaceFile;
      if (await deps.fs.exists(root, WORKSPACE_FILE)) {
        const readResult = await readWorkspaceFile(deps.fs, root);
        if (!readResult.ok) {
          current = { status: 'error', error: readResult.error, root };
          deps.eventBus?.publish('session.changed', undefined);
          return readResult;
        }
        file = readResult.value;
      } else {
        // Create new workspace.json (R-PJ-08)
        const folderName = root.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? 'project';
        const truncatedName = folderName.slice(0, 64);
        const responsiveMode = await detectResponsiveMode(deps.fs, root, 'src');

        file = newWorkspaceFile({
          id: nanoid(10),
          name: truncatedName,
          createdAt: deps.system.now().toISOString(),
          responsiveMode,
          framework: support.framework ?? 'vite-react',
        });

        await deps.fs.writeTextAtomic(root, WORKSPACE_FILE, serializeWorkspaceFile(file));
        await deps.fs.writeTextAtomic(root, '.reactcraft/.gitignore', 'lock\ncache/\n');
      }

      const trusted = deps.config.isTrusted(trustKeyOf(file, root));
      const needsInstall = await checkNeedsInstall(root);
      const backends = await computeBackendInfos(root, file, deps.platform, deps.homeDir);

      current = {
        status: 'open',
        root,
        file,
        support,
        trusted,
        needsInstall,
        backends,
      };

      const info = buildProjectInfo(root, file, support, trusted, needsInstall, backends);
      deps.eventBus?.publish('session.changed', undefined);
      deps.eventBus?.publish('project.changed', info);
      if (trusted && !needsInstall && support.supported) {
        void deps.runnerService?.start();
      }
      return ok(info);
    },

    async create(
      path: string,
      name: string,
      packageManager?: PackageManager,
    ): Promise<Result<ProjectInfo>> {
      const created = await createProject(path, name, {
        fs: deps.fs,
        platform: deps.platform,
        templateDir: deps.templateDir,
        homeDir: deps.homeDir,
      });

      if (!created.ok) return created;
      if (packageManager !== undefined) {
        createdPackageManagers.set(normalizeRoot(path, deps.platform), packageManager);
      }
      return this.open(path);
    },

    async close(): Promise<void> {
      await deps.runnerService?.stop();
      await releaseCurrentLock();
      current = { status: 'none' };
      deps.eventBus?.publish('session.changed', undefined);
    },

    getProjectInfo(): Result<ProjectInfo> {
      if (current.status !== 'open') {
        return err({ code: 'E021', params: { missing: 'project' } });
      }
      return ok(
        buildProjectInfo(
          current.root,
          current.file,
          current.support,
          current.trusted,
          current.needsInstall,
          current.backends,
        ),
      );
    },

    async patchProject(updates): Promise<Result<ProjectInfo>> {
      if (current.status !== 'open') {
        return err({ code: 'E021', params: { missing: 'project' } });
      }

      const updatedFile: WorkspaceFile = {
        ...current.file,
        name: updates.name ?? current.file.name,
        responsiveMode: updates.responsiveMode ?? current.file.responsiveMode,
        frames: updates.frames ? [...updates.frames] : current.file.frames,
        primaryFrameId: updates.primaryFrameId ?? current.file.primaryFrameId,
      };

      const write = await deps.fs.writeTextAtomic(
        current.root,
        WORKSPACE_FILE,
        serializeWorkspaceFile(updatedFile),
      );
      if (!write.ok) return write;

      current = { ...current, file: updatedFile };
      const info = buildProjectInfo(
        current.root,
        updatedFile,
        current.support,
        current.trusted,
        current.needsInstall,
        current.backends,
      );
      deps.eventBus?.publish('project.changed', info);
      return ok(info);
    },

    async setTrusted(trusted: boolean): Promise<Result<ProjectInfo>> {
      if (current.status !== 'open') {
        return err({ code: 'E021', params: { missing: 'project' } });
      }

      const saved = await deps.config.setTrusted(trustKeyOf(current.file, current.root), trusted);
      if (!saved.ok) return saved;

      current = { ...current, trusted };
      const info = buildProjectInfo(
        current.root,
        current.file,
        current.support,
        trusted,
        current.needsInstall,
        current.backends,
      );
      deps.eventBus?.publish('session.changed', undefined);
      deps.eventBus?.publish('project.changed', info);
      if (trusted && !current.needsInstall && current.support.supported) {
        void deps.runnerService?.start();
      }
      return ok(info);
    },

    async install(command: readonly string[]): Promise<Result<void>> {
      if (current.status !== 'open') {
        return err({ code: 'E021', params: { missing: 'project' } });
      }
      if (!current.trusted) {
        return err({ code: 'E011', params: { path: current.root, reason: 'untrusted' } });
      }
      if (!current.support.packageManager) {
        return err({ code: 'E021', params: { missing: 'packageManager' } });
      }

      const expectedCommand = getInstallCommand(current.support.packageManager);
      const isMismatch =
        !expectedCommand ||
        command.length !== expectedCommand.length ||
        command.some((part, i) => part !== expectedCommand[i]);

      if (isMismatch) {
        return err({ code: 'E016', params: { reason: 'commandMismatch' } });
      }

      const exe = command[0];
      if (!exe) {
        return err({ code: 'E016', params: { reason: 'commandMismatch' } });
      }

      const handle = deps.process.spawn(exe, command.slice(1), {
        cwd: current.root,
        timeoutMs: 600_000, // 10 minutes (E020)
      });

      const outcome = await handle.wait();
      if (outcome.exitCode === 124) {
        return err({ code: 'E020', params: { timeout: 600 } });
      }
      if (outcome.exitCode === 127) {
        return err({ code: 'E021', params: { missing: 'packageManager' } });
      }
      if (outcome.exitCode !== 0) {
        const details = outcome.lines.slice(-200).map((message) => ({ message }));
        return err({
          code: 'E028',
          details,
        });
      }

      const needsInstall = await checkNeedsInstall(current.root);
      current = { ...current, needsInstall };
      const info = buildProjectInfo(
        current.root,
        current.file,
        current.support,
        current.trusted,
        needsInstall,
        current.backends,
      );
      deps.eventBus?.publish('project.changed', info);
      if (!needsInstall && current.trusted && current.support.supported) {
        void deps.runnerService?.start();
      }
      return ok(undefined);
    },

    async theme(): Promise<Result<ThemeInfo>> {
      if (current.status !== 'open') {
        return err({ code: 'E021', params: { missing: 'project' } });
      }
      if (!current.support.tailwindCss) {
        return ok({
          colors: [],
          fontSizes: [],
          radii: [],
          fonts: [],
          shadows: [],
          breakpoints: [],
        });
      }
      return readThemeTokens(deps.fs, current.root, current.support.tailwindCss);
    },

    async addBackend(backendPath: string, customLabel?: string): Promise<Result<BackendInfo>> {
      if (current.status !== 'open') {
        return err({ code: 'E021', params: { missing: 'project' } });
      }

      const syntaxErr = checkPathSyntax(backendPath, deps.platform);
      if (syntaxErr !== undefined) return err(syntaxErr);

      const blockedErr = checkBlockedPath(backendPath, deps.platform, deps.homeDir);
      if (blockedErr !== undefined) return err(blockedErr);

      // S-28: cannot be project root
      if (
        isInside(current.root, backendPath, deps.platform) &&
        isInside(backendPath, current.root, deps.platform)
      ) {
        return err({ code: 'E016', params: { reason: 'cannotMatchProjectRoot' } });
      }

      const dirCheck = await deps.fs.readDir(backendPath, '.');
      if (!dirCheck.ok) {
        return err({ code: 'E015', params: { resource: 'directory', id: backendPath } });
      }

      // V-03 & V-04: store relative if in parent dir, absolute if outside
      const projectRoot = current.root;
      const storedPath = toStoredBackendPath(projectRoot, backendPath, deps.platform);
      const resolvedTarget = resolveBackendPath(projectRoot, storedPath);

      if (
        current.file.backends.some(
          (b) =>
            b.path === storedPath || resolveBackendPath(projectRoot, b.path) === resolvedTarget,
        )
      ) {
        return err({ code: 'E016', params: { reason: 'duplicateBackend' } });
      }

      if (current.file.backends.length >= 10) {
        return err({ code: 'E016', params: { reason: 'maxBackendsExceeded' } });
      }

      const folderName =
        backendPath.replaceAll('\\', '/').split('/').filter(Boolean).pop() ?? 'backend';
      const label = customLabel ?? folderName;

      const newBackend = {
        id: nanoid(10),
        path: storedPath,
        label,
      };

      const updatedFile: WorkspaceFile = {
        ...current.file,
        backends: [...current.file.backends, newBackend],
      };

      const write = await deps.fs.writeTextAtomic(
        current.root,
        WORKSPACE_FILE,
        serializeWorkspaceFile(updatedFile),
      );
      if (!write.ok) return write;

      // Update trust if currently trusted (R-PJ-14)
      if (current.trusted) {
        await deps.config.setTrusted(trustKeyOf(updatedFile, current.root), true);
      }

      const backends = await computeBackendInfos(
        current.root,
        updatedFile,
        deps.platform,
        deps.homeDir,
      );
      current = { ...current, file: updatedFile, backends };
      deps.eventBus?.publish(
        'project.changed',
        buildProjectInfo(
          current.root,
          updatedFile,
          current.support,
          current.trusted,
          current.needsInstall,
          backends,
        ),
      );

      const added = backends.find((b) => b.id === newBackend.id);
      return ok(
        added ?? (await toBackendInfo(current.root, newBackend, deps.platform, deps.homeDir)),
      );
    },

    async removeBackend(id: string): Promise<Result<void>> {
      if (current.status !== 'open') {
        return err({ code: 'E021', params: { missing: 'project' } });
      }

      const existing = current.file.backends.find((b) => b.id === id);
      if (!existing) {
        return err({ code: 'E015', params: { resource: 'backend', id } });
      }

      const updatedFile: WorkspaceFile = {
        ...current.file,
        backends: current.file.backends.filter((b) => b.id !== id),
      };

      const write = await deps.fs.writeTextAtomic(
        current.root,
        WORKSPACE_FILE,
        serializeWorkspaceFile(updatedFile),
      );
      if (!write.ok) return write;

      // Update trust if currently trusted
      if (current.trusted) {
        await deps.config.setTrusted(trustKeyOf(updatedFile, current.root), true);
      }

      const backends = await computeBackendInfos(
        current.root,
        updatedFile,
        deps.platform,
        deps.homeDir,
      );
      current = { ...current, file: updatedFile, backends };
      deps.eventBus?.publish(
        'project.changed',
        buildProjectInfo(
          current.root,
          updatedFile,
          current.support,
          current.trusted,
          current.needsInstall,
          backends,
        ),
      );

      return ok(undefined);
    },
  };
}
