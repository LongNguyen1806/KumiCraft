import type { BridgeBuildErrorPayload } from '@reactcraft/shared';
import { z } from 'zod';

export const ViteErrorSchema = z.object({
  err: z.object({
    message: z.string(),
    id: z.string().optional(),
    loc: z.object({ file: z.string().optional(), line: z.number(), column: z.number() }).optional(),
  }),
});

export function toRelativePath(filePath: string | undefined, rootDir: string): string | undefined {
  if (filePath === undefined) return undefined;
  const absolute = filePath.replaceAll('\\', '/');
  const root = `${rootDir.replaceAll('\\', '/').replace(/\/+$/, '')}/`;
  return absolute.toLowerCase().startsWith(root.toLowerCase())
    ? absolute.slice(root.length)
    : absolute;
}

/** A Vite build error as the Studio shows it: message, and the file relative to the project (R-BR-17). */
export function toBuildError(payload: unknown, rootDir: string): BridgeBuildErrorPayload {
  const parsed = ViteErrorSchema.safeParse(payload);
  if (!parsed.success) return { message: 'Build error' };
  const { message, id, loc } = parsed.data.err;
  if (loc !== undefined) {
    const file = toRelativePath(loc.file ?? id, rootDir);
    return {
      message: message.slice(0, 2000),
      ...(file === undefined ? {} : { file: file.slice(0, 1024) }),
      line: Math.max(1, loc.line),
      column: Math.max(1, loc.column + 1),
    };
  }

  const match = /\[\s*([^[\r\n\]]+?):(\d+):(\d+)\s*\]/.exec(message);
  if (match) {
    const rawFile = match[1]?.trim();
    const file = toRelativePath(rawFile ?? id, rootDir);
    const line = Number(match[2]);
    const column = Number(match[3]);
    return {
      message: message.slice(0, 2000),
      ...(file === undefined ? {} : { file: file.slice(0, 1024) }),
      line: Math.max(1, line),
      column: Math.max(1, column),
    };
  }

  const file = toRelativePath(id, rootDir);
  return {
    message: message.slice(0, 2000),
    ...(file === undefined ? {} : { file: file.slice(0, 1024) }),
  };
}
