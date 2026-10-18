// Shared types for ProjectService (SPEC-04 M-PJ).
import type { BackendInfo, SupportReport, WorkspaceFile } from '@reactcraft/shared';

import type { HistoryService } from '../history/history-service.ts';
import type { JobService } from '../jobs/job-service.ts';
import type { EventBusPort } from '../ports/event-bus-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';
import type { ProcessPort } from '../ports/process-port.ts';
import type { SystemPort } from '../ports/system-port.ts';
import type { AppError } from '../shared/result.ts';
import type { Platform } from '../shared/session.ts';
import type { ConfigStore } from '../shared/user-config.ts';

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
  readonly jobs?: JobService | undefined;
  readonly history?: HistoryService | Pick<HistoryService, 'clear'> | undefined;
  readonly watch?: { start(root: string): void; stop(): Promise<void> } | undefined;
};
