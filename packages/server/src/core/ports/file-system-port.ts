// FileSystemPort (SPEC-01.1 section 3.2, QC-63): the only way core touches files. Every path is
// relative to an allowed root and checked by the adapter (SPEC-05 S-20 to S-24).
import type { Result } from '../shared/result.ts';

export type DirectoryEntry = { readonly name: string; readonly kind: 'file' | 'directory' };

export type ReadOptions = {
  /** Larger files fail with E003 (`params.reason: 'tooLarge'`). Default: 20 MB (S-29). */
  readonly maxBytes?: number;
};

export type WriteOptions = {
  /** File mode on macOS and Linux, for example 0o600 for the user config (ADR-BE-24). */
  readonly mode?: number;
};

export interface FileSystemPort {
  /** Reads a UTF-8 file. Missing file: E015; unreadable: E003 or E011; outside root: E012. */
  readText(root: string, path: string, options?: ReadOptions): Promise<Result<string>>;
  /** Writes atomically (temp file + rename), creating parent folders. Refuses symlinks (S-24). */
  writeTextAtomic(
    root: string,
    path: string,
    content: string,
    options?: WriteOptions,
  ): Promise<Result<void>>;
  /** Creates the file only if it does not exist yet (`wx`). */
  createExclusive(
    root: string,
    path: string,
    content: string,
  ): Promise<Result<'created' | 'exists'>>;
  /** Lists a folder without following symlinks. Missing folder: an empty list. */
  readDir(root: string, path: string): Promise<Result<readonly DirectoryEntry[]>>;
  exists(root: string, path: string): Promise<boolean>;
  /** Removes a file or folder; missing is not an error. */
  remove(root: string, path: string): Promise<Result<void>>;
  copy(root: string, from: string, to: string): Promise<Result<void>>;
  rename(root: string, from: string, to: string): Promise<Result<void>>;
}
