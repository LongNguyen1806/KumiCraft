// Project-relative paths (SPEC-03 V-100). Whether the joined path stays inside the project is
// checked again by the server against the real file system (S-22).
import { z } from 'zod';

const MAX_LENGTH = 512;

/** Why a string is not a project-relative path, or undefined when it is one. */
export function relPathProblem(value: string): string | undefined {
  if (value.length === 0 || value.length > MAX_LENGTH) return 'length';
  if (value.includes('\\')) return 'backslash';
  // eslint-disable-next-line no-control-regex -- control characters are what this rejects
  if (/[\u0000-\u001f\u007f]/.test(value)) return 'control';
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return 'absolute';
  const segments = value.split('/');
  if (segments.some((part) => part === '' || part === '.' || part === '..')) return 'segment';
  return undefined;
}

/** V-100: 1..512 characters, `/` separators, no `.` or `..` segment, not absolute. */
export const RelPathSchema = z.string().refine((value) => relPathProblem(value) === undefined, {
  message: 'Not a project-relative path (V-100)',
});

export type RelPath = z.infer<typeof RelPathSchema>;
