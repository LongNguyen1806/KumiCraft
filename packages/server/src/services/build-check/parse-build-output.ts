// Reads the errors out of `tsc`, `vite build` and the Pug check (SPEC-04 M-BC). Every regex here
// runs on one line cut to MAX_LINE characters, so 1 MB of output stays well under 100 ms (S-86).
import {
  type BuildProblem,
  type BuildProblemSource,
  MAX_BUILD_PROBLEMS,
  relPathProblem,
} from '@kumicraft/shared';

const MAX_LINE = 4000;
const MAX_MESSAGE = 2000;
/** Vite prints one error (Vite 8: a few) in some dozen lines; the rest after it is noise. */
const MAX_VITE_LINES = 2000;

/** Colour codes (ESC [ … m) some tools print even with NO_COLOR. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '');
}

function linesOf(text: string): string[] {
  return stripAnsi(text)
    .split(/\r?\n/)
    .map((line) => (line.length > MAX_LINE ? line.slice(0, MAX_LINE) : line));
}

function normalize(path: string): string {
  return path.replaceAll('\\', '/');
}

/**
 * The project-relative path of `path` (absolute, or relative to `root`), or undefined when it
 * points outside the project. Windows paths compare without case.
 */
export function relativeToRoot(root: string, path: string): string | undefined {
  const base = normalize(root).replace(/\/+$/, '');
  let rel = normalize(path.trim());
  const isAbsolute = rel.startsWith('/') || /^[A-Za-z]:\//.test(rel);
  if (isAbsolute) {
    const windows = /^[A-Za-z]:\//.test(base);
    const head = rel.slice(0, base.length + 1);
    const same = windows ? head.toLowerCase() === `${base}/`.toLowerCase() : head === `${base}/`;
    if (!same) return undefined;
    rel = rel.slice(base.length + 1);
  }
  rel = rel.replace(/^(\.\/)+/, '');
  return relPathProblem(rel) === undefined ? rel : undefined;
}

function message(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_MESSAGE ? `${trimmed.slice(0, MAX_MESSAGE - 1)}…` : trimmed;
}

function located(
  root: string,
  source: BuildProblemSource,
  file: string,
  line: number,
  column: number | undefined,
  text: string,
): BuildProblem {
  const rel = relativeToRoot(root, file);
  // A file outside the project keeps its name in the message, since it cannot be opened.
  if (rel === undefined) return { source, message: message(`${file}: ${text}`) };
  return {
    source,
    file: rel,
    ...(line > 0 ? { line } : {}),
    ...(column !== undefined && column > 0 ? { column } : {}),
    message: message(text),
  };
}

const TSC_LOCATED = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const TSC_GLOBAL = /^error (TS\d+): (.*)$/;
/**
 * Stands for each error past MAX_BUILD_PROBLEMS: those only count towards `total` and are never
 * shown, so 40,000 errors cost a counter, not 40,000 parsed objects (S-86).
 */
const COUNTED_ONLY: BuildProblem = { source: 'tsc', message: '' };

/** `src/a.tsx(3,7): error TS2322: …` (with `--pretty false`); indented lines continue a message. */
export function parseTscOutput(text: string, root: string): BuildProblem[] {
  const problems: BuildProblem[] = [];
  for (const raw of linesOf(text)) {
    if (problems.length >= MAX_BUILD_PROBLEMS) {
      if (raw.includes('): error TS') || raw.startsWith('error TS')) problems.push(COUNTED_ONLY);
      continue;
    }
    const at = raw.includes('): error TS') ? (TSC_LOCATED.exec(raw) ?? undefined) : undefined;
    if (at !== undefined) {
      const [, file = '', line = '0', column = '0', code = '', rest = ''] = at;
      problems.push(located(root, 'tsc', file, Number(line), Number(column), `${code}: ${rest}`));
      continue;
    }
    const global = raw.startsWith('error TS') ? (TSC_GLOBAL.exec(raw) ?? undefined) : undefined;
    if (global !== undefined) {
      problems.push({ source: 'tsc', message: message(`${global[1] ?? ''}: ${global[2] ?? ''}`) });
      continue;
    }
    const last = problems.at(-1);
    if (last !== undefined && /^\s+\S/.test(raw) && last.message.length < MAX_MESSAGE) {
      problems[problems.length - 1] = {
        ...last,
        message: message(`${last.message} ${raw.trim()}`),
      };
    }
  }
  return problems;
}

/** `file: <path>[:line:col][ (importer)]`, the location line Vite prints under a build error. */
function viteFileLine(raw: string): { file: string; line: number; column?: number } | undefined {
  if (!raw.startsWith('file: ')) return undefined;
  let rest = raw.slice('file: '.length).trim();
  const importer = rest.indexOf(' (');
  if (importer >= 0) rest = rest.slice(0, importer);
  const at = /^(.*):(\d+):(\d+)$/.exec(rest) ?? undefined;
  if (at === undefined) return { file: rest, line: 0 };
  return { file: at[1] ?? rest, line: Number(at[2]), column: Number(at[3]) };
}

/** Rolldown (Vite 8) frames the location: `╭─[ src/main.ts:1:15 ]`. */
const BOX_LOCATION = /\[ (.+):(\d+):(\d+) \]/;
/** Rolldown starts each error with its code: `[UNRESOLVED_IMPORT] Could not resolve …`. */
const ROLLDOWN_CODE = /^\[[A-Z][A-Z0-9_]*\] /;

type ViteEntry = { text: string; where?: { file: string; line: number; column?: number } };

function viteLocation(raw: string): ViteEntry['where'] {
  const box = raw.includes(' ]') ? (BOX_LOCATION.exec(raw) ?? undefined) : undefined;
  if (box !== undefined) {
    return { file: box[1] ?? '', line: Number(box[2]), column: Number(box[3]) };
  }
  return viteFileLine(raw.trim());
}

/** Message lines, not the code excerpt and the arrows drawn under it. */
function isViteMessage(raw: string, entries: readonly ViteEntry[]): boolean {
  const text = raw.trim();
  if (text === '' || /^Build failed with \d+ errors?:?$/.test(text)) return false;
  if (/^[│╭╰─┬\d]/.test(text)) return false;
  return entries.length === 0 || ROLLDOWN_CODE.test(text);
}

/**
 * After `error during build:` Vite 7 prints a message and a `file: …` line; Vite 8 prints
 * `Build failed with N errors:` and per error `[CODE] message` with a framed location. The stack
 * (`at …`) ends it. Output without the header (a crash before the build) gives one problem.
 */
export function parseViteOutput(text: string, root: string): BuildProblem[] {
  const lines = linesOf(text);
  const header = lines.findIndex((line) => line.trim() === 'error during build:');
  if (header < 0) {
    const first = lines.filter((line) => line.trim() !== '').slice(0, 3);
    return first.length === 0 ? [] : [{ source: 'vite', message: message(first.join(' ')) }];
  }
  const entries: ViteEntry[] = [];
  for (const raw of lines.slice(header + 1, header + 1 + MAX_VITE_LINES)) {
    if (/^\s+at /.test(raw)) break;
    const last = entries.at(-1);
    const where = viteLocation(raw);
    if (where !== undefined && last !== undefined && last.where === undefined) {
      last.where = where;
    } else if (where === undefined && isViteMessage(raw, entries)) {
      entries.push({ text: raw.trim() });
    }
  }
  return entries.map((entry) =>
    entry.where === undefined
      ? { source: 'vite', message: message(entry.text) }
      : located(root, 'vite', entry.where.file, entry.where.line, entry.where.column, entry.text),
  );
}

export type PugCheckError = {
  readonly file: string;
  readonly line?: number | undefined;
  readonly column?: number | undefined;
  readonly message: string;
};

/** The Pug check prints one JSON line `{ "errors": [...] }` as its last line. */
export function parsePugOutput(text: string, root: string): BuildProblem[] | undefined {
  const last = linesOf(text)
    .filter((line) => line.trim().startsWith('{'))
    .at(-1);
  if (last === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(last);
  } catch {
    return undefined;
  }
  if (!(parsed instanceof Object) || !('errors' in parsed)) return undefined;
  const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
  return errors.flatMap((item: unknown): BuildProblem[] => {
    if (typeof item !== 'object' || !item) return [];
    const file = 'file' in item && typeof item.file === 'string' ? item.file : '';
    const text = 'message' in item && typeof item.message === 'string' ? item.message : '';
    const line = 'line' in item && typeof item.line === 'number' ? item.line : 0;
    const column = 'column' in item && typeof item.column === 'number' ? item.column : undefined;
    return [located(root, 'pug', file, line, column, text)];
  });
}
