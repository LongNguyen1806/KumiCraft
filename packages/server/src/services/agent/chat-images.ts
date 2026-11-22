// Chat image storage in KumiCraft cache (R-CH-02, CW-52, S-118).
import { join } from 'node:path';

import { CHAT_IMAGE_KINDS, type ChatImageKind } from '@kumicraft/shared';
import { nanoid } from 'nanoid';

import { err, ok, type Result } from '../../kernel/result.ts';
import { detectImageKind } from '../../lib/images.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ChatImageStoreDeps = {
  readonly fs: FileSystemPort;
  readonly cacheDir: string;
  readonly now: () => Date;
  readonly newId?: () => string;
};

export type ChatImageStore = {
  save(
    projectId: string,
    kind: ChatImageKind,
    bytes: Uint8Array,
  ): Promise<Result<{ readonly id: string }>>;
  resolve(projectId: string, ids: readonly string[]): Promise<Result<readonly string[]>>;
  dirOf(projectId: string): string;
};

async function pruneExpiredImages(
  fs: FileSystemPort,
  cacheDir: string,
  projectId: string,
  now: Date,
): Promise<void> {
  const relDir = `chat-images/${projectId}`;
  const listRes = await fs.readDir(cacheDir, relDir);
  if (!listRes.ok) return;

  const cutoff = now.getTime() - SEVEN_DAYS_MS;
  for (const entry of listRes.value) {
    if (entry.kind !== 'file') continue;
    const filePath = `${relDir}/${entry.name}`;
    const statRes = await fs.stat(cacheDir, filePath);
    if (statRes.ok && statRes.value.mtimeMs < cutoff) {
      await fs.remove(cacheDir, filePath);
    }
  }
}

export function createChatImageStore(deps: ChatImageStoreDeps): ChatImageStore {
  const nextId = deps.newId ?? (() => nanoid(10));

  return {
    dirOf(projectId: string): string {
      return join(deps.cacheDir, 'chat-images', projectId);
    },

    async save(projectId, kind, bytes) {
      if (bytes.length > MAX_IMAGE_BYTES) {
        return err({ code: 'E016', params: { reason: 'imageTooLarge' } });
      }

      const detected = detectImageKind(bytes);
      if (detected !== kind) {
        return err({ code: 'E016', params: { reason: 'notAnImage' } });
      }

      const id = nextId();
      const extName: string = kind;
      const relPath = `chat-images/${projectId}/${id}.${extName}`;
      const writeRes = await deps.fs.writeBytesAtomic(deps.cacheDir, relPath, bytes);
      if (!writeRes.ok) {
        return writeRes;
      }

      await pruneExpiredImages(deps.fs, deps.cacheDir, projectId, deps.now());
      return ok({ id });
    },

    async resolve(projectId, ids) {
      const paths: string[] = [];
      for (const id of ids) {
        let foundPath: string | undefined;
        for (const ext of CHAT_IMAGE_KINDS) {
          const extName: string = ext;
          const relPath = `chat-images/${projectId}/${id}.${extName}`;
          if (await deps.fs.exists(deps.cacheDir, relPath)) {
            foundPath = join(deps.cacheDir, 'chat-images', projectId, `${id}.${extName}`);
            break;
          }
        }
        if (foundPath === undefined) {
          return err({ code: 'E015', params: { resource: 'image', id } });
        }
        paths.push(foundPath);
      }
      return ok(paths);
    },
  };
}
