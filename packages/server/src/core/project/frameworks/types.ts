// Framework adapter types (SPEC-04 section 1, M-FW).
import type {
  EditMode,
  FrameworkId,
  PagesInfo,
  RelPath,
  RunnerOptions,
  SupportReport,
} from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';

export type DetectInput = {
  readonly root: string;
  readonly packageJson: unknown;
  readonly fs: FileSystemPort;
};

export type RunnerContext = {
  readonly root: string;
  readonly sourceDir: RelPath;
  readonly port: number;
  /** The port the user picked (`devPort`, R-RN-04); absent: the runner reads the project's. */
  readonly projectPort?: number;
  readonly nonce: string;
  readonly studioOrigin: string;
  /** Drafts folder served by the Bridge plugin (R-DR-12). */
  readonly draftsDir?: RelPath;
  /** The project's Tailwind CSS entry, loaded by the draft page (R-DR-12). */
  readonly tailwindCss?: RelPath;
  readonly globalCss?: string[];
  readonly serverEntry?: RelPath;
  readonly viewsDir?: RelPath;
};

export type { RunnerOptions };

export interface FrameworkAdapter {
  readonly id: FrameworkId;
  /** Primary dependency to identify adapter for E001 reason selection (R-FW-02), e.g. 'vite'. */
  readonly primaryDependency: string;
  /** Read-only inspection of project files. */
  detect(input: DetectInput): Promise<SupportReport>;
  /** File extensions for location tagging and AST mutation; [] = view only. */
  readonly sourceExtensions: readonly string[];
  /** File extensions containing data-rc-loc elements (to open in editor, find tree). */
  readonly markupExtensions: readonly string[];
  readonly editMode: EditMode;
  /** Packages that must sit in node_modules before the project runs (R-PJ-06). */
  readonly requiredPackages: readonly string[];
  /** Runner script and options for child dev server process. */
  readonly runner: {
    readonly entry: string;
    options(ctx: RunnerContext): RunnerOptions;
  };
  /** Folder name inside templates/. Absent if adapter doesn't create projects. */
  readonly template?: string;
  readonly routes?: unknown;
  /** File changed triggers runner restart (Express: .js/.cjs/.mjs outside views and public). */
  restartOn?(relPath: string): boolean;
  pages?(ctx: {
    readonly fs: FileSystemPort;
    readonly root: string;
    readonly support: SupportReport;
    readonly sourceDir: string;
    readonly serverEntry?: string | undefined;
    readonly viewsDir?: string | undefined;
  }): Promise<PagesInfo>;
}
