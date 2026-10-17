// Framework adapter types (SPEC-04 section 1, M-FW).
import type { FrameworkId, RelPath, SupportReport } from '@reactcraft/shared';

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
};

export type RunnerOptions = RunnerContext & {
  readonly host: '127.0.0.1';
};

export interface FrameworkAdapter {
  readonly id: FrameworkId;
  /** Primary dependency to identify adapter for E001 reason selection (R-FW-02), e.g. 'vite'. */
  readonly primaryDependency: string;
  /** Read-only inspection of project files. */
  detect(input: DetectInput): Promise<SupportReport>;
  /** File extensions for location tagging and AST mutation. */
  readonly sourceExtensions: readonly string[];
  /** Runner script and options for child dev server process. */
  readonly runner: {
    readonly entry: string;
    options(ctx: RunnerContext): RunnerOptions;
  };
  /** Folder name inside templates/. */
  readonly template: string;
  readonly routes?: unknown;
}
