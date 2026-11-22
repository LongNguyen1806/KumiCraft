// The axes of a project (docs/architecture/03-kien-truc-dich.md section 3): who runs the page
// (RuntimeAdapter) and what language the view is written in (ViewLanguage). A project's stack is
// one runtime plus one view language; the kernel and the services know only these interfaces, and
// the implementations live in `stacks/`, wired together in `index.ts`. Interfaces may still change
// until a second view language can edit (ADR-A7).
import type {
  FrameworkId,
  PagesInfo,
  RelPath,
  RunnerOptions,
  SupportReport,
} from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { ViewFeatures } from './features.ts';

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

export type PagesContext = {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly support: SupportReport;
  readonly sourceDir: string;
  readonly serverEntry?: string | undefined;
  readonly viewsDir?: string | undefined;
};

/** How the location stamp gets into the page (03 section 3.1; the third kind, shadowCopy, later). */
export type StampHost = 'buildPlugin' | 'templateHook';

/** Axis A: runs the project's page on the Canvas with the Bridge in it. */
export interface RuntimeAdapter {
  readonly id: 'vite' | 'express';
  /** Package that names this runtime in a project, to pick the right "unsupported" reason. */
  readonly primaryDependency: string;
  readonly stampHost: StampHost;
  /** Read-only look at the project's files; says whether this runtime (and its view) fits. */
  detect(input: DetectInput): Promise<SupportReport>;
  /** M-BC: `vite` = `tsc` then `vite build` in a temp folder, `pug` = compile every view. */
  readonly buildCheck?: 'vite' | 'pug' | undefined;
  /** Packages that must sit in node_modules before the project runs (R-PJ-06). */
  readonly requiredPackages: readonly string[];
  /** Child process that serves the page, and its options. */
  readonly runner: {
    readonly entry: string;
    options(ctx: RunnerContext): RunnerOptions;
  };
  /** Folder inside templates/ for new projects; absent: this runtime does not create projects. */
  readonly template?: string | undefined;
  /** A changed file that needs the runner restarted (Express: server code). */
  restartOn?(relPath: string): boolean;
  /** Pages found from the server's own routes, when the runtime decides them. */
  pages?(ctx: PagesContext): Promise<PagesInfo>;
}

/** Reasons a tool cannot act, shared by every view language (03 section 7). */
export const CAPABILITY_REASONS = ['viewOnly'] as const;
export type CapabilityReason = (typeof CAPABILITY_REASONS)[number];

/** What the view language of the project lets KumiCraft do (ADR-A5). */
export type Capability =
  { readonly edit: true } | { readonly edit: false; readonly reason: CapabilityReason };

/** Axis B: the language the project's views are written in. */
export interface ViewLanguage {
  readonly id: 'jsx' | 'pug';
  /** Files KumiCraft can change; empty when the language has no editor yet. */
  readonly sourceExtensions: readonly string[];
  /** Files whose elements carry the location stamp (open in editor, element tree). */
  readonly markupExtensions: readonly string[];
  readonly capability: Capability;
  /** Tools only this language has (03 section 3.2); absent: none of them. */
  readonly features?: ViewFeatures | undefined;
}

/** One row of the combination table: a runtime and the view language it runs. */
export type ProjectStack = {
  /** The id saved in workspace.json and shown by the API (kept from 1.0). */
  readonly id: FrameworkId;
  readonly runtime: RuntimeAdapter;
  readonly view: ViewLanguage;
};

export function canEdit(stack: ProjectStack): boolean {
  return stack.view.capability.edit;
}

/** The combination table: never empty, the first row is the default stack. */
export type StackTable = readonly [ProjectStack, ...ProjectStack[]];
