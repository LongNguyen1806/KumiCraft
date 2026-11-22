import type {
  BackendInfo,
  CreateDraft,
  DraftFile,
  DraftsInfo,
  ExtractComponent,
  PackageManager,
  PagesInfo,
  ProjectInfo,
  ProjectProbe,
  PromoteDraft,
  RenameDraft,
  StructureResult,
  SupportReport,
  ThemeEdit,
  ThemeInfo,
  ThemeTokenKind,
  ThemeUsage,
  WorkspaceFile,
} from '@kumicraft/shared';

import type { AddPageInput, DeletePageInput, RenamePageInput } from '../../kernel/features.ts';
import { err, ok, type Result } from '../../kernel/result.ts';
import { createJobService, type JobService } from '../jobs/job-service.ts';
import { acquireLock, type LockInfo, releaseLock } from '../workspace/lock.ts';
import { rememberPort } from '../workspace/studio-port.ts';
import { trustKeyOf } from '../workspace/trust.ts';
import { createProject } from './create.ts';
import type { ProjectStack } from './frameworks/index.ts';
import { moveLegacyWorkspace } from './legacy-workspace.ts';
import { probeProject, probeSupportedProject } from './probe.ts';
import { applyAddBackend, applyRemoveBackend, computeBackendInfos } from './project-backends.ts';
import { buildPageEditDeps, listProjectDirs } from './project-dirs.ts';
import {
  handleCreateDraft,
  handleDeleteDraft,
  handleDuplicateDraft,
  handleListDrafts,
  handlePromoteDraft,
  handleRenameDraft,
  type ProjectTools,
} from './project-draft-ops.ts';
import {
  normalizeRoot,
  projectInfoOf,
  resolveOpenSupport,
  withKnownPackageManager,
} from './project-info.ts';
import { checkNeedsInstall, startProjectInstall } from './project-install.ts';
import { readStackPages } from './project-pages.ts';
import { editProjectTheme, queryThemeUsage, readProjectTheme } from './project-theme-ops.ts';
import type { ProjectService, ProjectServiceDeps, WorkspaceState } from './project-types.ts';
import {
  applyPatchProject,
  applySetTrusted,
  loadOrCreateWorkspaceFile,
  type PatchWorkspaceUpdates,
  reloadOpenWorkspace,
} from './project-workspace-file.ts';
import { installProjectRouter } from './router-install-job.ts';
export type { ProjectService, ProjectServiceDeps, WorkspaceState };

class ProjectServiceImpl implements ProjectService {
  private current: WorkspaceState;
  private currentStack: ProjectStack;
  private heldLock: { root: string; info: LockInfo } | undefined;
  private readonly createdPackageManagers = new Map<string, PackageManager>();
  private readonly deps: ProjectServiceDeps;
  private readonly jobs: JobService;

  constructor(deps: ProjectServiceDeps) {
    this.deps = deps;
    this.currentStack = deps.stacks[0];
    this.jobs =
      deps.jobs ??
      createJobService({ system: deps.system, logger: deps.logger, eventBus: deps.eventBus });
    this.current = deps.initialRoot
      ? { status: 'none', suggestedPath: deps.initialRoot }
      : { status: 'none' };
  }

  getStack(): ProjectStack {
    return this.currentStack;
  }

  state(): WorkspaceState {
    return this.current;
  }

  async probe(path: string): Promise<Result<ProjectProbe>> {
    return probeProject(path, {
      fs: this.deps.fs,
      platform: this.deps.platform,
      homeDir: this.deps.homeDir,
      stacks: this.deps.stacks,
    });
  }

  private async releaseCurrentLock(): Promise<void> {
    if (this.heldLock !== undefined) {
      await releaseLock(this.deps.fs, this.heldLock.root, this.heldLock.info);
      this.heldLock = undefined;
    }
  }

  async open(targetPath?: string): Promise<Result<ProjectInfo>> {
    const given =
      targetPath ?? (this.current.status === 'open' ? this.current.root : this.deps.initialRoot);
    if (!given) return err({ code: 'E021', params: { missing: 'project' } });
    // Vite reports module ids by real path (macOS /var -> /private/var, Windows RUNNER~1), so the
    // root must match or the Bridge stamps no file of the project.
    const root = await this.deps.fs.realRoot(given);
    const moved = await moveLegacyWorkspace(this.deps.fs, root);
    if (!moved.ok) this.deps.logger.warn({ code: moved.error.code }, 'cannot move .reactcraft');

    const probed = await probeSupportedProject(root, {
      fs: this.deps.fs,
      platform: this.deps.platform,
      homeDir: this.deps.homeDir,
      stacks: this.deps.stacks,
    });
    if (!probed.ok) return probed;

    this.currentStack = probed.value.stack;
    const support = resolveOpenSupport(
      root,
      probed.value.report,
      this.createdPackageManagers,
      this.deps.config.settings().packageManager,
      this.deps.platform,
    );
    if (this.heldLock !== undefined) await this.releaseCurrentLock();

    // R-HI-08: steps of another project must never be undone into this one.
    if (this.current.status === 'open' && this.current.root !== root) {
      this.stopProjectWork();
      this.deps.history?.clear();
      // The dev server of the previous project keeps its port; the Canvas would show that app.
      await this.deps.runnerService?.stop();
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
    const known = await withKnownPackageManager(support, fileRes.value, this.deps);
    const info = await this.finishOpen(root, fileRes.value, known);
    const remembered = await this.deps.recents?.rememberProject(root, info.name);
    if (remembered?.ok === false) {
      this.deps.logger.warn({ code: remembered.error.code }, 'cannot remember the recent project');
    }
    return ok(info);
  }

  private async finishOpen(
    root: string,
    file: WorkspaceFile,
    support: SupportReport,
  ): Promise<ProjectInfo> {
    const trusted = this.deps.config.isTrusted(trustKeyOf(file, root));
    const needsInstall = await checkNeedsInstall(
      this.deps.fs,
      root,
      this.currentStack.runtime.requiredPackages,
    );
    const backends = await computeBackendInfos(
      this.deps.fs,
      root,
      file,
      this.deps.platform,
      this.deps.homeDir,
    );

    this.current = { status: 'open', root, file, support, trusted, needsInstall, backends };
    this.deps.watch?.start(root);
    const info = projectInfoOf(this.current);
    this.deps.eventBus?.publish('session.changed', undefined);
    this.deps.eventBus?.publish('project.changed', info);
    if (trusted && !needsInstall && support.supported) void this.deps.runnerService?.start();
    return info;
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
      stacks: this.deps.stacks,
    });
    if (!created.ok) return created;
    if (packageManager !== undefined) {
      // Keyed by the real path, as `open` looks it up (a short or linked path names the same folder).
      const root = await this.deps.fs.realRoot(path);
      this.createdPackageManagers.set(normalizeRoot(root, this.deps.platform), packageManager);
    }
    return this.open(path);
  }

  /**
   * The AI turn, the install and the build check of the project being left: a turn would go on
   * changing that project with nobody able to see or stop it (spec-log #116).
   */
  private stopProjectWork(): void {
    this.jobs.cancelKind('agent.turn');
    this.jobs.cancelKind('project.install');
    this.jobs.cancelKind('project.buildCheck');
  }

  async close(): Promise<void> {
    this.stopProjectWork();
    await this.deps.watch?.stop();
    this.deps.history?.clear();
    await this.deps.runnerService?.stop();
    await this.releaseCurrentLock();
    this.currentStack = this.deps.stacks[0];
    this.current = { status: 'none' };
    this.deps.eventBus?.publish('session.changed', undefined);
  }

  getProjectInfo(): Result<ProjectInfo> {
    if (this.current.status !== 'open')
      return err({ code: 'E021', params: { missing: 'project' } });
    return ok(projectInfoOf(this.current));
  }

  async patchProject(updates: PatchWorkspaceUpdates): Promise<Result<ProjectInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    const write = await applyPatchProject(this.deps, this.current, updates);
    if (!write.ok) return write;
    this.current = write.value;
    const info = projectInfoOf(this.current);
    this.deps.eventBus?.publish('project.changed', info);
    return ok(info);
  }

  async setTrusted(trusted: boolean): Promise<Result<ProjectInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    const saved = await applySetTrusted(this.deps, this.current, trusted);
    if (!saved.ok) return saved;
    this.current = saved.value;
    const info = projectInfoOf(this.current);
    this.deps.eventBus?.publish('session.changed', undefined);
    this.deps.eventBus?.publish('project.changed', info);
    if (trusted && !this.current.needsInstall && this.current.support.supported) {
      void this.deps.runnerService?.start();
    }
    return ok(info);
  }

  install(command: readonly string[]): Promise<Result<{ readonly jobId: string }>> {
    return Promise.resolve(
      startProjectInstall(
        this.current,
        { jobs: this.jobs, process: this.deps.process },
        command,
        (root) => this.afterInstall(root),
      ),
    );
  }

  installRouter(): Promise<Result<{ readonly jobId: string }>> {
    return installProjectRouter(
      this.current,
      {
        fs: this.deps.fs,
        history: this.deps.history,
        jobs: this.jobs,
        process: this.deps.process,
        features: this.currentStack.view.features?.project,
      },
      (root) => this.afterInstall(root),
    );
  }

  /** Install done: needsInstall again, project.changed, dev server (R-PJ-13). */
  private async afterInstall(root: string): Promise<void> {
    const needsInstall = await checkNeedsInstall(
      this.deps.fs,
      root,
      this.currentStack.runtime.requiredPackages,
    );
    if (this.current.status !== 'open' || this.current.root !== root) return;
    this.current = { ...this.current, needsInstall };
    const info = projectInfoOf(this.current);
    this.deps.eventBus?.publish('project.changed', info);
    if (!needsInstall && this.current.trusted && this.current.support.supported) {
      void this.deps.runnerService?.start();
    }
  }

  async pages(): Promise<Result<PagesInfo>> {
    if (this.current.status !== 'open')
      return err({ code: 'E021', params: { missing: 'project' } });
    return readStackPages(this.currentStack, this.current, this.deps.fs);
  }

  /** The page, draft and component tools of the open project's view language (ADR-A5). */
  private projectTools(): Result<ProjectTools> {
    const capability = this.currentStack.view.capability;
    if (this.current.status === 'open' && !capability.edit) {
      return err({ code: 'E023', params: { reason: capability.reason } });
    }
    const features = this.currentStack.view.features?.project;
    if (features === undefined) return err({ code: 'E023', params: { reason: 'viewOnly' } });
    const deps = buildPageEditDeps(this.current, this.deps);
    return deps.ok ? ok({ deps: deps.value, features }) : deps;
  }

  // A meta-framework's pages (Next.js files) first, else the view language's route list.
  async addPage(input: AddPageInput): Promise<Result<StructureResult>> {
    const tools = this.projectTools();
    if (!tools.ok) return tools;
    const pages = this.currentStack.pages;
    return pages
      ? pages.add(tools.value.deps, input)
      : tools.value.features.addPage(tools.value.deps, input);
  }

  async renamePage(input: RenamePageInput): Promise<Result<StructureResult>> {
    const tools = this.projectTools();
    if (!tools.ok) return tools;
    const pages = this.currentStack.pages;
    return pages
      ? pages.rename(tools.value.deps, input)
      : tools.value.features.renamePage(tools.value.deps, input);
  }

  async deletePage(input: DeletePageInput): Promise<Result<StructureResult>> {
    const tools = this.projectTools();
    if (!tools.ok) return tools;
    const pages = this.currentStack.pages;
    return pages
      ? pages.remove(tools.value.deps, input)
      : tools.value.features.deletePage(tools.value.deps, input);
  }

  async extractComponent(input: ExtractComponent): Promise<Result<StructureResult>> {
    const tools = this.projectTools();
    if (!tools.ok) return tools;
    const { deps, features } = tools.value;
    // Reading types runs the project's TypeScript: only for a trusted project (S-80).
    const script = this.deps.propTypesScriptPath;
    const trusted = this.current.status === 'open' && this.current.trusted;
    const propTypes =
      script === undefined || !trusted
        ? undefined
        : features.createPropTypesPort({
            process: this.deps.process,
            scriptPath: script,
            root: deps.projectRoot,
          });
    return features.extractComponent({ ...deps, propTypes }, input);
  }

  async dirs(): Promise<Result<readonly string[]>> {
    if (this.current.status !== 'open')
      return err({ code: 'E021', params: { missing: 'project' } });
    return ok(await listProjectDirs(this.deps.fs, this.current.root, this.current.file.sourceDir));
  }

  async listDrafts(): Promise<Result<DraftsInfo>> {
    return handleListDrafts(this.currentStack.view.capability, this.projectTools());
  }

  async createDraft(input: CreateDraft): Promise<Result<StructureResult>> {
    return handleCreateDraft(this.projectTools(), input);
  }

  async renameDraft(input: RenameDraft): Promise<Result<StructureResult>> {
    return handleRenameDraft(this.projectTools(), input);
  }

  async duplicateDraft(input: DraftFile): Promise<Result<StructureResult>> {
    return handleDuplicateDraft(this.projectTools(), input);
  }

  async deleteDraft(input: DraftFile): Promise<Result<StructureResult>> {
    return handleDeleteDraft(this.projectTools(), input);
  }

  async promoteDraft(input: PromoteDraft): Promise<Result<StructureResult>> {
    return handlePromoteDraft(this.projectTools(), input);
  }

  theme(): Promise<Result<ThemeInfo>> {
    return readProjectTheme(this.deps, this.current);
  }

  editTheme(edit: ThemeEdit): Promise<Result<ThemeInfo>> {
    return editProjectTheme(this.deps, this.current, edit, this.currentStack.view.capability);
  }

  themeUsage(kind: ThemeTokenKind, name: string): Promise<Result<ThemeUsage>> {
    return queryThemeUsage(this.deps, this.current, kind, name);
  }

  async addBackend(backendPath: string, customLabel?: string): Promise<Result<BackendInfo>> {
    const res = await applyAddBackend(this.deps, this.current, backendPath, customLabel);
    if (!res.ok) return res;
    this.current = res.value.next;
    return ok(res.value.added);
  }

  async removeBackend(id: string): Promise<Result<void>> {
    const res = await applyRemoveBackend(this.deps, this.current, id);
    if (!res.ok) return res;
    this.current = res.value.next;
    return ok(undefined);
  }

  async reloadWorkspaceFile(): Promise<void> {
    if (this.current.status !== 'open') return;
    const before = this.current;
    const next = await reloadOpenWorkspace(this.deps, before);
    // Skip when nothing changed, or the project was closed or switched meanwhile.
    if (next === undefined || this.current !== before) return;
    this.current = next;
    this.deps.eventBus?.publish('project.changed', projectInfoOf(next));
    if (next.trusted === before.trusted) return;
    this.deps.eventBus?.publish('session.changed', undefined);
    // S-84: links changed from outside put the project back in restricted mode (S-81).
    if (!next.trusted) await this.deps.runnerService?.stop();
  }
}

export function createProjectService(deps: ProjectServiceDeps): ProjectService {
  return new ProjectServiceImpl(deps);
}
