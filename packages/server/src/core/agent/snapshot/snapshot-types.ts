// Types and constants for agent turn snapshot and revert (WP-3.04, S-113, R-AG-12, R-AG-15).
import type { TurnFile } from '@reactcraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { LoggerPort } from '../../ports/logger-port.ts';
import type { Result } from '../../shared/result.ts';

export const SNAPSHOT_MAX_BYTES = 200 * 1024 * 1024; // S-113
export const SNAPSHOT_KEEP_TURNS = 20; // S-113
export const SNAPSHOT_DIFF_MAX_BYTES = 1024 * 1024; // larger files: no diff text
export const SNAPSHOT_EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.reactcraft',
] as const;

export type SnapshotEntry = {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
  readonly mtimeMs: number;
};

export type TurnManifest = {
  readonly version: 1;
  readonly turnId: string;
  readonly createdAt: string;
  readonly before: readonly SnapshotEntry[];
  readonly after?: readonly SnapshotEntry[] | undefined;
  readonly changes?: readonly TurnFile[] | undefined;
  readonly reverted: boolean;
};

export type TurnSnapshotStore = {
  /** Before a turn: records every tracked file; E016 projectTooLarge when over the limit. */
  capture(
    projectId: string,
    projectRoot: string,
    turnId: string,
  ): Promise<Result<{ readonly files: number; readonly bytes: number }>>;
  /** After a turn: records the new state and returns what changed, sorted by path (R-AG-12). */
  finish(
    projectId: string,
    projectRoot: string,
    turnId: string,
  ): Promise<Result<readonly TurnFile[]>>;
  /** Unified diff of one changed file, 3 context lines (ADR-BE-17). */
  diff(projectId: string, turnId: string, path: string): Promise<Result<string>>;
  /** R-AG-15: all-or-nothing restore of the files the turn changed. */
  revert(
    projectId: string,
    projectRoot: string,
    turnId: string,
  ): Promise<Result<readonly TurnFile[]>>;
};

export type SnapshotStoreDeps = {
  readonly fs: FileSystemPort;
  readonly dataDir: string;
  readonly logger: LoggerPort;
};

export type SnapshotStoreOptions = {
  readonly maxBytes?: number | undefined;
  readonly keepTurns?: number | undefined;
};
