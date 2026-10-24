import {
  type BackendInfo,
  type CreateDraft,
  type DraftFile,
  type DraftsInfo,
  type ExtractComponent,
  type PackageManager,
  type PagesInfo,
  type ProjectInfo,
  type ProjectProbe,
  type PromoteDraft,
  type RenameDraft,
  type StructureResult,
  type SupportReport,
  type ThemeEdit,
  type ThemeInfo,
  type ThemeTokenKind,
  type ThemeUsage,
  type WorkspaceFile,
} from '@reactcraft/shared';

import { createJobService, type JobService } from '../jobs/job-service.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { acquireLock, type LockInfo, releaseLock } from '../workspace/lock.ts';
import { rememberPort } from '../workspace/studio-port.ts';
import { trustKeyOf } from '../workspace/trust.ts';
import { extractComponent } from './component-extract.ts';
import { createProject } from './create.ts';
import { promoteDraft } from './draft-promote.ts';
import { createDraft, deleteDraft, duplicateDraft, listDrafts, renameDraft } from './drafts.ts';
import {
  type AddPageInput,
  buildPageEditDeps,
  type DeletePageInput,
  listProjectDirs,
  type PageEditDeps,
  type RenamePageInput,
} from './page-common.ts';
import { addPage, deletePage, renamePage } from './page-edits.ts';
import { readPages } from './pages.ts';
import { probeProject, probeSupportedProject } from './probe.ts';
import { applyAddBackend, applyRemoveBackend, computeBackendInfos } from './project-backends.ts';
import { normalizeRoot, projectInfoOf, resolveOpenSupport } from './project-info.ts';
import { checkNeedsInstall, getInstallCommand, startInstallJob } from './project-install.ts';
import type { ProjectService, ProjectServiceDeps, WorkspaceState } from './project-types.ts';
import {
  executePatchWorkspaceFile,
  loadOrCreateWorkspaceFile,
  type PatchWorkspaceUpdates,
  reloadOpenWorkspace,
} from './project-workspace-file.ts';
import { countProjectThemeUsage, editProjectTheme, readThemeTokens } from './theme.ts';
export type { ProjectService, ProjectServiceDeps, WorkspaceState };

class ProjectServiceImpl implements ProjectService {
  private current: WorkspaceState;
  private heldLock: { root: string; info: LockInfo } | undefined;
  private readonly createdPackageManagers = new Map<string, PackageManager>();
  private readonly deps: ProjectServiceDeps;
  private readonly jobs: JobService;

  constructor(deps: ProjectServiceDeps) {
    this.deps = deps;
    this.jobs =
      deps.jobs ??
      createJobService({ system: deps.system, logger: deps.logger, eventBus: deps.eventBus });
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

  private async releaseCurrentLock(): Promise<void> {
    if (this.heldLock !== undefined) {
      await releaseLock(this.deps.fs, this.heldLock.root, this.heldLock.info);
      this.heldLock = undefined;
    }
  }

  async open(targetPath?: string): Promise<Result<ProjectInfo>> {
    const root =
      targetPath ?? (this.current.status === 'open' ? this.current.root : this.deps.initialRoot);
    if (!root) {
      return err({ code: 'E021', params: { missing: 'project' } });
    }

    const probed = await probeSupportedProject(root, {
      fs: this.deps.fs,
      platform: this.deps.platform,
      homeDir: this.deps.homeDir,
    });
    if (!probed.ok) return probed;

    const support = resolveOpenSupport(
      root,
      probed.value,
      this.createdPackageManagers,
      this.deps.config.settings().packageManager,
      this.deps.platform,
    );
    if (this.heldLock !== undefined) {
      await this.releaseCurrentLock();
    }

    // R-HI-08: steps of another project must never be undone into this one.
    if (this.current.status === 'open' && this.current.root !== root) {
      this.deps.history?.clear();
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
    const info = await this.finishOpen(root, fileRes.value, support);
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
    const needsInstall = await checkNeedsInstall(this.deps.fs, root);
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
    if (trusted && !needsInstall && support.supported) {
      void this.deps.runnerService?.start();
    }
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
    });
    if (!created.ok) return created;
    if (packageManager !== undefined) {
      this.createdPackageManagers.set(normalizeRoot(path, this.deps.platform), packageManager);
    }
    return this.open(path);
  }

  async close(): Promise<void> {
    this.jobs.cancelKind('project.install');
    await this.deps.watch?.stop();
    this.deps.history?.clear();
    await this.deps.runnerService?.stop();
    await this.releaseCurrentLock();
    this.current = { status: 'none' };
    this.deps.eventBus?.publish('session.changed', undefined);
  }

  getProjectInfo(): Result<ProjectInfo> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    return ok(projectInfoOf(this.current));
  }

  async patchProject(updates: PatchWorkspaceUpdates): Promise<Result<ProjectInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }

    const write = await executePatchWorkspaceFile(
      this.deps.fs,
      this.current.root,
      this.current.file,
      this.current.file.sourceDir,
      this.deps.platform,
      updates,
    );
    if (!write.ok) return write;

    this.current = { ...this.current, file: write.value };
    const info = projectInfoOf(this.current);
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
    const info = projectInfoOf(this.current);
    this.deps.eventBus?.publish('session.changed', undefined);
    this.deps.eventBus?.publish('project.changed', info);
    if (trusted && !this.current.needsInstall && this.current.support.supported) {
      void this.deps.runnerService?.start();
    }
    return ok(info);
  }

  install(command: readonly string[]): Promise<Result<{ readonly jobId: string }>> {
    return Promise.resolve(this.startInstall(command));
  }

  private startInstall(command: readonly string[]): Result<{ readonly jobId: string }> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    if (!this.current.trusted) {
      return err({ code: 'E011', params: { path: this.current.root, reason: 'untrusted' } });
    }
    if (!this.current.support.packageManager) {
      return err({ code: 'E021', params: { missing: 'packageManager' } });
    }

    const { root } = this.current;
    const expectedCommand = getInstallCommand(this.current.support.packageManager);
    return startInstallJob(
      { jobs: this.jobs, process: this.deps.process },
      root,
      command,
      expectedCommand,
      () => this.afterInstall(root),
    );
  }

  /** Install done: needsInstall again, project.changed, dev server (R-PJ-13). */
  private async afterInstall(root: string): Promise<void> {
    const needsInstall = await checkNeedsInstall(this.deps.fs, root);
    if (this.current.status !== 'open' || this.current.root !== root) return;
    this.current = { ...this.current, needsInstall };
    const info = projectInfoOf(this.current);
    this.deps.eventBus?.publish('project.changed', info);
    if (!needsInstall && this.current.trusted && this.current.support.supported) {
      void this.deps.runnerService?.start();
    }
  }

  async pages(): Promise<Result<PagesInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    return ok(await readPages(this.deps.fs, this.current.root, this.current.file.sourceDir));
  }

  private getPageEditDeps(): Result<PageEditDeps> {
    return buildPageEditDeps(this.current, this.deps);
  }

  async addPage(input: AddPageInput): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    if (!deps.ok) return deps;
    return addPage(deps.value, input);
  }

  async renamePage(input: RenamePageInput): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    if (!deps.ok) return deps;
    return renamePage(deps.value, input);
  }

  async deletePage(input: DeletePageInput): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    if (!deps.ok) return deps;
    return deletePage(deps.value, input);
  }

  async extractComponent(input: ExtractComponent): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    if (!deps.ok) return deps;
    return extractComponent(deps.value, input);
  }

  async dirs(): Promise<Result<readonly string[]>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    const dirs = await listProjectDirs(
      this.deps.fs,
      this.current.root,
      this.current.file.sourceDir,
    );
    return ok(dirs);
  }

  async listDrafts(): Promise<Result<DraftsInfo>> {
    const deps = this.getPageEditDeps();
    return deps.ok ? listDrafts(deps.value) : deps;
  }

  async createDraft(input: CreateDraft): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    return deps.ok ? createDraft(deps.value, input) : deps;
  }

  async renameDraft(input: RenameDraft): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    return deps.ok ? renameDraft(deps.value, input) : deps;
  }

  async duplicateDraft(input: DraftFile): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    return deps.ok ? duplicateDraft(deps.value, input) : deps;
  }

  async deleteDraft(input: DraftFile): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    return deps.ok ? deleteDraft(deps.value, input) : deps;
  }

  async promoteDraft(input: PromoteDraft): Promise<Result<StructureResult>> {
    const deps = this.getPageEditDeps();
    return deps.ok ? promoteDraft(deps.value, input) : deps;
  }

  async theme(): Promise<Result<ThemeInfo>> {
    if (this.current.status !== 'open') {
      return err({ code: 'E021', params: { missing: 'project' } });
    }
    const css = this.current.support.tailwindCss;
    if (!css) {
      return ok({ colors: [], fontSizes: [], radii: [], fonts: [], shadows: [], breakpoints: [] });
    }
    return readThemeTokens(this.deps.fs, this.current.root, css);
  }

  editTheme(edit: ThemeEdit): Promise<Result<ThemeInfo>> {
    return editProjectTheme(this.current, this.deps, edit);
  }

  themeUsage(kind: ThemeTokenKind, name: string): Promise<Result<ThemeUsage>> {
    return countProjectThemeUsage(this.current, this.deps, kind, name);
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
