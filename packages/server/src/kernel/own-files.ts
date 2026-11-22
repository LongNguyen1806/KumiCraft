// Files KumiCraft owns inside a project (`.kumicraft/…`: settings, lists, caches). They are not the
// user's code, so they skip the FileWriter's checks and Undo; this is the only other way a project
// file is written, and it refuses anything outside `.kumicraft/` (docs/architecture/03 section 4).
import { err, type Result } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';

export const OWN_DIR = '.kumicraft/';

export function isOwnFile(rel: string): boolean {
  return rel.replaceAll('\\', '/').startsWith(OWN_DIR);
}

export function writeOwnFile(
  fs: FileSystemPort,
  root: string,
  rel: string,
  content: string,
): Promise<Result<void>> {
  if (!isOwnFile(rel)) {
    return Promise.resolve(err({ code: 'E012', params: { path: rel, reason: 'notOwnFile' } }));
  }
  return fs.writeTextAtomic(root, rel, content);
}
