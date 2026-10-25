// FileSystemPort (SPEC-01 section 3.2, QC-63): the only way core touches files. Every path is
// relative to an allowed root and checked by the adapter (SPEC-05 S-20 to S-24).
import type { Result } from '../shared/result.ts';

export type DirectoryEntry = { readonly name: string; readonly kind: 'file' | 'directory' };

export type FileStat = { readonly size: number; readonly mtimeMs: number };

export type ReadOptions = {
  /** Larger files fail with E003 (`params.reason: 'tooLarge'`). Default: 20 MB (S-29). */
  readonly maxBytes?: number;
  /** Keep BOM if present (default: false, strips BOM). Needed by M-SE to preserve BOM (R-SE-10). */
  readonly keepBom?: boolean;
};

export type WriteOptions = {
  /** File mode on macOS and Linux, for example 0o600 for the user config (ADR-BE-24). */
  readonly mode?: number;
};

export interface FileSystemPort {
  /** Reads a UTF-8 file. Missing file: E015; unreadable: E003 or E011; outside root: E012. */
  readText(root: string, path: string, options?: ReadOptions): Promise<Result<string>>;
  /** Reads binary data. Missing file: E015; unreadable: E003 or E011; outside root: E012. */
  readBytes(root: string, path: string, options?: ReadOptions): Promise<Result<Uint8Array>>;
  /** Writes atomically (temp file + rename), creating parent folders. Refuses symlinks (S-24). */
  writeTextAtomic(
    root: string,
    path: string,
    content: string,
    options?: WriteOptions,
  ): Promise<Result<void>>;
  /** Writes binary atomically (temp file + rename), creating parent folders. Refuses symlinks (S-24). */
  writeBytesAtomic(
    root: string,
    path: string,
    bytes: Uint8Array,
    options?: WriteOptions,
  ): Promise<Result<void>>;
  /** Creates the file only if it does not exist yet (`wx`). */
  createExclusive(
    root: string,
    path: string,
    content: string,
  ): Promise<Result<'created' | 'exists'>>;
  /** Creates a directory recursively, checking path syntax and symlinks (S-20 to S-24). */
  mkdir(root: string, path: string): Promise<Result<void>>;
  /** Lists a folder without following symlinks. Missing folder: an empty list. */
  readDir(root: string, path: string): Promise<Result<readonly DirectoryEntry[]>>;
  exists(root: string, path: string): Promise<boolean>;
  /** Removes a file or folder; missing is not an error. */
  remove(root: string, path: string): Promise<Result<void>>;
  copy(root: string, from: string, to: string): Promise<Result<void>>;
  rename(root: string, from: string, to: string): Promise<Result<void>>;
  /** Size and modification time without following symlinks (lstat). Missing: E015; outside root: E012. */
  stat(root: string, path: string): Promise<Result<FileStat>>;
  /**
   * The folder's real path: symlinks resolved and, on Windows, 8.3 short names expanded. Vite and
   * the Bridge see module ids by real path, so a project root must be one too. Missing: unchanged.
   */
  realRoot(path: string): Promise<string>;
}
