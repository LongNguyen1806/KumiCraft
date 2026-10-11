// Pure path rules of SPEC-05 section 7.2. Resolving real paths needs the disk, so the file system
// adapter does S-22 and S-24 and calls these checks (core never imports node:fs, QC-63).
import type { AppError } from './result.ts';
import type { Platform } from './session.ts';

export const MAX_PATH_LENGTH = 1024; // S-20

/** S-20: C0 control characters and DEL. */
function hasControlCharacter(path: string): boolean {
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

const violation = (path: string, reason: string): AppError => ({
  code: 'E012',
  params: { path, reason },
});

/**
 * S-20, S-21: rejects paths a safe join could still misread.
 *
 * @returns undefined when the path is acceptable, or E012 with `params.reason`.
 */
export function checkPathSyntax(path: string, platform: Platform): AppError | undefined {
  if (path.length > MAX_PATH_LENGTH) return violation(path.slice(0, 64), 'tooLong');
  if (hasControlCharacter(path)) return violation('', 'controlCharacter');
  if (platform !== 'win32') return undefined;
  if (/^[\\/]{2}/.test(path)) return violation(path, 'uncOrDevicePath'); // \\server\share, \\?\, \\.\
  if (/^[a-z]:(?![\\/])/i.test(path)) return violation(path, 'driveRelative'); // C:foo
  const segments = path.split(/[\\/]/);
  const tail = path.replace(/^[a-z]:/i, '');
  if (tail.includes(':')) return violation(path, 'alternateDataStream'); // file.txt:stream
  if (segments.some((segment) => WINDOWS_RESERVED.test(segment.replace(/[ .]+$/, '')))) {
    return violation(path, 'reservedName');
  }
  return undefined;
}

/** S-23: case-insensitive on Windows and macOS, prefix must end at a separator. */
export function isInside(root: string, candidate: string, platform: Platform): boolean {
  const normalize = (p: string) => {
    const unified = p.replaceAll('\\', '/').replace(/\/+$/, '');
    return platform === 'linux' ? unified : unified.toLowerCase();
  };
  const base = normalize(root);
  const target = normalize(candidate);
  return target === base || target.startsWith(`${base}/`);
}

export const MAX_JSON_DEPTH = 64; // S-29

/** S-29: nesting depth of JSON text, counted without parsing (strings are skipped). */
export function jsonDepth(text: string): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      max = Math.max(max, ++depth);
    } else if (char === '}' || char === ']') {
      depth--;
    }
  }
  return max;
}
