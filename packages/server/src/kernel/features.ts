// Tools that only some view languages have (docs/architecture/03 section 3.2: "an extension of the
// language itself, declared by it"). A view language offers them through `ViewLanguage.features`;
// the HTTP routes ask the open project's view for them and answer "view only" when it has none.
// Today only JSX has them. Style tools work for every view language and come from the style stack.
import type {
  ApplySmoothScrollRequest,
  ApplySmoothScrollResult,
  BridgeStyleProbePayload,
  ComponentPropsResponse,
  CreateDraft,
  DraftFile,
  DraftsInfo,
  EnableDarkModeResult,
  ExtractComponent,
  InteractionAction,
  InteractionResult,
  PagesInfo,
  ProjectComponent,
  ProjectInfo,
  PromoteDraft,
  RelPath,
  RenameDraft,
  ResolvedDesignDirs,
  Result,
  RevealRequest,
  RevealResult,
  StructureResult,
  StyleApplyRequest,
  StyleReading,
  StyleSystemId,
  StylingReport,
  ThemeEdit,
  ThemeInfo,
  ThemeTokenKind,
  ThemeUsage,
} from '@kumicraft/shared';

import type { CompiledCssPort } from '../ports/compiled-css-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import type { SourceEditorService, WrittenFile } from './editing.ts';
import type { HistoryService } from './history/history-service.ts';
import type { Platform } from './session.ts';

/** Counts where a component is used; a batch reads each file once (component list). */
export type UsageCounter = {
  count(projectRoot: string, sourceDir: string, file: string, component: string): Promise<number>;
  /** A counter for one listing: what it reads is read once and kept until it is dropped. */
  batch(): UsageCounter;
};

export type ComponentPropsDeps = {
  readonly fs: FileSystemPort;
  readonly process?: ProcessPort | undefined;
  readonly tsInspectScript?: string | undefined;
};

export type ComponentsListDeps = {
  readonly fs: FileSystemPort;
  readonly usageCounter?: UsageCounter | undefined;
};

/** Project-wide tools (dark mode, smooth scroll): they write and record one Undo step. */
export type ProjectToolDeps = {
  readonly fs: FileSystemPort;
  readonly styling?: StylingReport | undefined;
  readonly sourceDir?: string | undefined;
  readonly tailwindCss?: RelPath | undefined;
  readonly onWritten?: (files: readonly WrittenFile[], labelKey: string) => void;
};

export type InteractionOpsDeps = {
  readonly fs: FileSystemPort;
  readonly styling?: StylingReport | undefined;
  readonly sourceDir?: string | undefined;
  readonly onWritten?: (files: readonly WrittenFile[], labelKey: string, tag: string) => void;
};

export type RevealDeps = {
  readonly fs: FileSystemPort;
  readonly onWritten?: (files: readonly WrittenFile[]) => void;
};

/** Types of an extracted component's props, from the project's TypeScript (FR-72). */
export type PropTypesPort = (request: {
  readonly file: string;
  readonly names: readonly { readonly name: string; readonly offset: number }[];
}) => Promise<Result<readonly string[]>>;

/** What the page, draft and component tools need about the open project. */
export type PageEditDeps = {
  readonly fs: FileSystemPort;
  readonly history: HistoryService;
  readonly projectRoot: string;
  readonly sourceDir: string;
  readonly platform: Platform;
  readonly language: 'ts' | 'js';
  readonly designDirs: ResolvedDesignDirs;
  readonly styling?: StylingReport | undefined;
  /** Types of the props of an extracted component, from the project's TypeScript (FR-72). */
  readonly propTypes?: PropTypesPort | undefined;
};

export type AddPageInput = {
  readonly name: string;
  readonly path?: string | undefined;
  readonly dir?: string | undefined;
  readonly fileName?: string | undefined;
};

export type RenamePageInput = {
  readonly path: string;
  readonly newPath?: string | undefined;
  readonly newName?: string | undefined;
};

export type DeletePageInput = {
  readonly path: string;
};

/** Pages, drafts, components and the router: the project tools of a view language. */
export interface ProjectFeatures {
  readPages(fs: FileSystemPort, root: string, sourceDir: string): Promise<PagesInfo>;
  addPage(deps: PageEditDeps, input: AddPageInput): Promise<Result<StructureResult>>;
  renamePage(deps: PageEditDeps, input: RenamePageInput): Promise<Result<StructureResult>>;
  deletePage(deps: PageEditDeps, input: DeletePageInput): Promise<Result<StructureResult>>;
  extractComponent(deps: PageEditDeps, input: ExtractComponent): Promise<Result<StructureResult>>;
  createPropTypesPort(deps: {
    readonly process: ProcessPort;
    readonly scriptPath: string;
    readonly root: string;
  }): PropTypesPort;
  listDrafts(deps: PageEditDeps): Promise<Result<DraftsInfo>>;
  createDraft(deps: PageEditDeps, input: CreateDraft): Promise<Result<StructureResult>>;
  renameDraft(deps: PageEditDeps, input: RenameDraft): Promise<Result<StructureResult>>;
  duplicateDraft(deps: PageEditDeps, input: DraftFile): Promise<Result<StructureResult>>;
  deleteDraft(deps: PageEditDeps, input: DraftFile): Promise<Result<StructureResult>>;
  promoteDraft(deps: PageEditDeps, input: PromoteDraft): Promise<Result<StructureResult>>;
  /** Writes the router files (routes file, entry, package.json) as one Undo step. */
  writeRouterFiles(
    deps: { readonly fs: FileSystemPort; readonly history: HistoryService },
    project: {
      readonly root: string;
      readonly sourceDir: string;
      readonly routingFile?: string | undefined;
      readonly language: 'ts' | 'js';
    },
  ): Promise<Result<void>>;
}

export interface ViewFeatures {
  readonly project: ProjectFeatures;
  readComponentProps(
    deps: ComponentPropsDeps,
    projectRoot: string,
    loc: string,
    tag: string,
    boundary?: { readonly parentLoc?: string; readonly componentName?: string },
  ): Promise<Result<ComponentPropsResponse>>;
  findFileImporters(
    fs: FileSystemPort,
    root: string,
    sourceDir: string,
    targetPath: string,
  ): Promise<Result<{ importers: RelPath[]; truncated: boolean }>>;
  enableDarkMode(
    deps: ProjectToolDeps,
    root: string,
    checkOnly?: boolean,
  ): Promise<Result<EnableDarkModeResult>>;
  applySmoothScroll(
    deps: ProjectToolDeps,
    root: string,
    request: ApplySmoothScrollRequest,
  ): Promise<Result<ApplySmoothScrollResult>>;
  listComponents(
    deps: ComponentsListDeps,
    root: string,
    info: ProjectInfo,
  ): Promise<ProjectComponent[]>;
  applyInteraction(
    deps: InteractionOpsDeps,
    root: string,
    action: InteractionAction,
  ): Promise<Result<InteractionResult>>;
  applyReveal(
    deps: RevealDeps,
    root: string,
    request: RevealRequest,
  ): Promise<Result<RevealResult>>;
  /** Checks a block of view code before it is inserted (its first tag, its syntax). */
  validateInsertedMarkup(markup: string): Result<{ readonly firstTag: string }>;
}

/** Where the project's theme tokens live (R-TH-10 to R-TH-14). */
export type TokenFiles = {
  readonly root: string;
  readonly styling: StylingReport | undefined;
  readonly tailwindCss: RelPath | undefined;
  readonly sourceDir: string;
  readonly tokenFile?: RelPath | undefined;
};

export type TokenDeps = {
  readonly fs: FileSystemPort;
  /** A full History records the theme edit as one Undo step; without it nothing is recorded. */
  readonly history?: HistoryService | Pick<HistoryService, 'clear'> | undefined;
};

/** The project's theme tokens (colors, sizes, fonts…), for every style system (R-TH-10). */
export interface ThemeTokens {
  read(
    deps: { readonly fs: FileSystemPort },
    files: TokenFiles,
    primary: StyleSystemId | undefined,
  ): Promise<Result<ThemeInfo>>;
  edit(
    deps: TokenDeps,
    files: TokenFiles,
    primary: StyleSystemId | undefined,
    edit: ThemeEdit,
  ): Promise<Result<ThemeInfo>>;
  countUsage(
    deps: { readonly fs: FileSystemPort },
    files: TokenFiles,
    primary: StyleSystemId | undefined,
    kind: ThemeTokenKind,
    name: string,
  ): Promise<Result<ThemeUsage>>;
}

export type StyleProject = {
  readonly root: string;
  readonly styling?: StylingReport | undefined;
};

export type StyleApplyDeps = {
  readonly fs: FileSystemPort;
  readonly sourceEditor: Pick<SourceEditorService, 'getElement' | 'applyEdit'>;
  readonly newId?: (() => string) | undefined;
  readonly styling?: StylingReport | undefined;
  readonly compiledCss?: CompiledCssPort | undefined;
  readonly newCssDir?: string | undefined;
  readonly theme?: ThemeInfo | undefined;
};

export type StyleApplied = {
  readonly files: readonly WrittenFile[];
  readonly className?: string | undefined;
};

/** The style stack, for every view language (03 section 3.3). */
export interface StyleService {
  /** R-ST-04: the probe of one element (from the Bridge) as properties with their sources. */
  read(project: StyleProject, probe: BridgeStyleProbePayload): Promise<StyleReading>;
  /** One Inspector change written to the project's styles (R-ST-06 to R-ST-09). */
  apply(
    deps: StyleApplyDeps,
    root: string,
    request: StyleApplyRequest,
  ): Promise<Result<StyleApplied>>;
}
