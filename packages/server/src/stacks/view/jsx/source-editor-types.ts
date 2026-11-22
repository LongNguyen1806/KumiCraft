// What the JSX editor needs from the server and the open project (SPEC-04 section 6).
import type { UsageCounter } from '../../../kernel/features.ts';
import type { ViewLanguage } from '../../../kernel/stacks.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';
import type { SnippetFormatter } from './snippet-format.ts';
import type { NewCssDirProvider, StylingProvider } from './structure/insert-css.ts';

export type SourceEditorDeps = {
  readonly fs: FileSystemPort;
  readonly usageCounter?: UsageCounter | undefined;
  /** Lays out inserted JSX (M-FM); absent: the built-in layout without the project's Prettier. */
  readonly formatSnippet?: SnippetFormatter | undefined;
  readonly styling?: StylingProvider;
  readonly newCssDir?: NewCssDirProvider;
  /** The view language of the open project: what may be edited (Capability, ADR-A5). */
  readonly getView?: () => ViewLanguage;
  /** The open project's `sourceDir` (Express: its views folder, read from the app). */
  readonly getProjectSourceDir?: () => string | undefined;
};

export type SourceEditorConfig = {
  readonly sourceDir?: string | undefined;
  readonly sourceExtensions?: readonly string[] | undefined;
};
