import type {
  BackendInfo,
  CreateDraft,
  DesignDirs,
  DraftFile,
  DraftsInfo,
  ExtractComponent,
  Frame,
  PackageManager,
  PagesInfo,
  ProjectInfo,
  ProjectProbe,
  PromoteDraft,
  RenameDraft,
  ResponsiveMode,
  Routing,
  StructureResult,
  StyleFiles,
  SupportReport,
  ThemeEdit,
  ThemeInfo,
  ThemeTokenKind,
  ThemeUsage,
  WorkspaceFile,
} from '@kumicraft/shared';

import type { HistoryService } from '../history/history-service.ts';
import type { JobService } from '../jobs/job-service.ts';
import type { MirrorService } from '../mirror/mirror-types.ts';
import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import type { AppError, Result } from '../shared/result.ts';
import type { Platform } from '../shared/session.ts';
import type { ConfigStore } from '../shared/user-config.ts';
import type { AddPageInput, DeletePageInput, RenamePageInput } from './page-common.ts';

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
  /** R-PJ-25: every opened project goes to the user's recent list. */
  readonly recents?: Pick<ConfigStore, 'rememberProject'> | undefined;
  readonly logger: LoggerPort;
  readonly eventBus?: EventBusPort | undefined;
  readonly port: number;
  readonly platform: Platform;
  readonly homeDir?: string | undefined;
  readonly templateDir: string;
  readonly initialRoot?: string | undefined;
  readonly runnerService?: { start(): Promise<unknown>; stop(): Promise<unknown> } | undefined;
  readonly jobs?: JobService | undefined;
  readonly history?: HistoryService | Pick<HistoryService, 'clear'> | undefined;
  readonly watch?: { start(root: string): void; stop(): Promise<void> } | undefined;
  readonly mirror?: Pick<MirrorService, 'refresh' | 'remove'> | undefined;
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
    readonly devPort?: number | 'auto' | undefined;
    readonly designDirs?: DesignDirs | undefined;
    readonly styleFiles?: StyleFiles | undefined;
    readonly routing?: Routing | undefined;
  }): Promise<Result<ProjectInfo>>;
  setTrusted(trusted: boolean): Promise<Result<ProjectInfo>>;
  install(command: readonly string[]): Promise<Result<{ readonly jobId: string }>>;
  pages(): Promise<Result<PagesInfo>>;
  theme(): Promise<Result<ThemeInfo>>;
  editTheme(edit: ThemeEdit): Promise<Result<ThemeInfo>>;
  themeUsage(kind: ThemeTokenKind, name: string): Promise<Result<ThemeUsage>>;
  addPage(input: AddPageInput): Promise<Result<StructureResult>>;
  renamePage(input: RenamePageInput): Promise<Result<StructureResult>>;
  deletePage(input: DeletePageInput): Promise<Result<StructureResult>>;
  extractComponent(input: ExtractComponent): Promise<Result<StructureResult>>;
  dirs(): Promise<Result<readonly string[]>>;
  listDrafts(): Promise<Result<DraftsInfo>>;
  createDraft(input: CreateDraft): Promise<Result<StructureResult>>;
  renameDraft(input: RenameDraft): Promise<Result<StructureResult>>;
  duplicateDraft(input: DraftFile): Promise<Result<StructureResult>>;
  deleteDraft(input: DraftFile): Promise<Result<StructureResult>>;
  promoteDraft(input: PromoteDraft): Promise<Result<StructureResult>>;
  addBackend(path: string, label?: string): Promise<Result<BackendInfo>>;
  removeBackend(id: string): Promise<Result<void>>;
  /** `workspace.json` changed on disk: read it again (project.changed, S-84). */
  reloadWorkspaceFile(): Promise<void>;
};
