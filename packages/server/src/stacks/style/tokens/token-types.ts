// What one style system does with the project's theme tokens (R-TH-10 to R-TH-14).
import type {
  RelPath,
  Result,
  StyleSystemId,
  ThemeEdit,
  ThemeInfo,
  ThemeToken,
  ThemeTokenKind,
} from '@kumicraft/shared';

import type { TokenFiles } from '../../../kernel/features.ts';
import type { FileSystemPort } from '../../../ports/file-system-port.ts';

export type { TokenFiles };

export interface TokenAdapter {
  readonly system: StyleSystemId;
  read(fs: FileSystemPort, files: TokenFiles): Promise<Result<ThemeInfo>>;
  plan(
    fs: FileSystemPort,
    files: TokenFiles,
    edit: ThemeEdit,
  ): Promise<Result<{ readonly file: RelPath; readonly before: string; readonly after: string }>>;
  countUses(source: string, file: string, kind: ThemeTokenKind, token: ThemeToken): number;
}
