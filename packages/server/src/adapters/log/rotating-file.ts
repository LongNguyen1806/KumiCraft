// Log file with size rotation (SPEC-05 S-88): `reactcraft.log`, then `.1` to `.<keep - 1>`.
// Synchronous writes so the last entries survive a crash or Ctrl+C.
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const LOG_FILE_NAME = 'reactcraft.log';
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_KEEP = 5;

export type RotatingFile = {
  write(chunk: string): void;
  close(): void;
};

export function createRotatingFile(
  directory: string,
  maxBytes = DEFAULT_MAX_BYTES,
  keep = DEFAULT_KEEP,
): RotatingFile {
  mkdirSync(directory, { recursive: true });
  const path = (index: number) =>
    join(directory, index === 0 ? LOG_FILE_NAME : `${LOG_FILE_NAME}.${String(index)}`);

  const rotate = () => {
    rmSync(path(keep - 1), { force: true });
    for (let index = keep - 2; index >= 0; index--) {
      if (existsSync(path(index))) renameSync(path(index), path(index + 1));
    }
  };

  let size = existsSync(path(0)) ? statSync(path(0)).size : 0;
  if (size >= maxBytes) {
    rotate();
    size = 0;
  }
  let descriptor = openSync(path(0), 'a');

  return {
    write(chunk: string) {
      const bytes = Buffer.byteLength(chunk);
      if (size > 0 && size + bytes > maxBytes) {
        closeSync(descriptor);
        rotate();
        descriptor = openSync(path(0), 'a');
        size = 0;
      }
      writeSync(descriptor, chunk);
      size += bytes;
    },
    close() {
      closeSync(descriptor);
    },
  };
}
