// Mirror types and limits (ADR-BE-34, R-MR-01 to R-MR-04, S-120 to S-125).
import type { BackendInfo } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import type { LoggerPort } from '../ports/logger-port.ts';

export const MIRROR_MAX_TOTAL_BYTES = 50 * 1024 * 1024; // S-124
export const MIRROR_MAX_FILE_BYTES = 1024 * 1024; // S-122
export const MIRROR_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.venv',
  'venv',
  '__pycache__',
  'target',
] as const; // S-120

export type MirrorState = 'ready' | 'skipped' | 'tooLarge' | 'failed';

export type MirrorResult = {
  readonly backendId: string;
  readonly label: string;
  readonly state: MirrorState;
  /** Absolute folder the agent may read; only when `state` is 'ready'. */
  readonly dir?: string | undefined;
  readonly files: number; // files in the mirror after the refresh
  readonly bytes: number; // sum of their source sizes
  readonly copied: number; // files written in this refresh (new or changed)
};

export type MirrorCheck = 'intact' | 'modified' | 'absent';

export type MirrorOptions = {
  readonly maxTotalBytes?: number;
  readonly maxFileBytes?: number;
};

export type MirrorService = {
  /** R-MR-02: incremental refresh; never throws. */
  refresh(projectId: string, backend: BackendInfo): Promise<MirrorResult>;
  /** R-MR-04, S-118: compares mirror files with the manifest; 'modified' also deletes the mirror. */
  check(projectId: string, backendId: string): Promise<MirrorCheck>;
  /** S-125: deletes the mirror and its manifest; missing is fine. */
  remove(projectId: string, backendId: string): Promise<void>;
};

export type MirrorDeps = {
  readonly fs: FileSystemPort;
  readonly cacheDir: string;
  readonly logger: LoggerPort;
};
