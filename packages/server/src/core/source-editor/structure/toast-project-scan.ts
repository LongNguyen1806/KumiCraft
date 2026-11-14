// What a project already has for notices (QA K9.8-1, plan K9.8 "no conflict with user code"):
// its own toast library, and a notice host already on a page or layout. KumiCraft never adds a
// second toast system or a second host.
import { err, ok, type Result } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';

/** Toast libraries that bring their own `toast()` and host; KumiCraft hands those projects to the AI tab. */
export const TOAST_LIBRARIES = [
  'sonner',
  'react-hot-toast',
  'react-toastify',
  'notistack',
  '@mui/material',
  '@chakra-ui/react',
  '@mantine/notifications',
  '@radix-ui/react-toast',
] as const;

const KIT_HOST_RE = /<ToastHost\b/;
const OTHER_HOST_RE = /<(?:Toaster|ToastContainer|SnackbarProvider|ToastProvider)\b/;
/** Files rendered for every page: an entry, the App shell or a layout. */
const SHARED_FILE_RE = /(?:^|\/)(?:main|App|app|root|index)\.[jt]sx?$|\/layouts?\//;
const SOURCE_RE = /\.(?:tsx|jsx|ts|js)$/;
const MAX_FILES = 1500;
const MAX_DEPTH = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value instanceof Object && !Array.isArray(value);
}

/** The first toast library the project depends on, if any. */
export async function projectToastLibrary(
  fs: FileSystemPort,
  root: string,
): Promise<string | undefined> {
  const read = await fs.readText(root, 'package.json');
  if (!read.ok) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.value);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  const names = new Set<string>();
  for (const field of ['dependencies', 'devDependencies']) {
    const deps = parsed[field];
    if (isRecord(deps)) for (const name of Object.keys(deps)) names.add(name);
  }
  return TOAST_LIBRARIES.find((lib) => names.has(lib));
}

export type ToastHostFound = {
  readonly file: string;
  /** `kit`: KumiCraft's ToastHost; `other`: the project's own notice system. */
  readonly kind: 'kit' | 'other';
  /** Rendered for every page (entry, App shell, layout). */
  readonly shared: boolean;
};

type Walk = { readonly fs: FileSystemPort; readonly root: string; count: number };

async function findHostIn(
  walk: Walk,
  dir: string,
  depth: number,
): Promise<ToastHostFound | undefined> {
  if (depth > MAX_DEPTH) return undefined;
  const entries = await walk.fs.readDir(walk.root, dir);
  if (!entries.ok) return undefined;
  for (const entry of entries.value) {
    if (walk.count >= MAX_FILES) return undefined;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      const found = await findHostIn(walk, rel, depth + 1);
      if (found !== undefined) return found;
    } else if (SOURCE_RE.test(entry.name)) {
      walk.count += 1;
      const text = await walk.fs.readText(walk.root, rel, { maxBytes: 1024 * 1024 });
      if (!text.ok) continue;
      const shared = SHARED_FILE_RE.test(rel);
      if (OTHER_HOST_RE.test(text.value)) return { file: rel, kind: 'other', shared };
      if (shared && KIT_HOST_RE.test(text.value)) return { file: rel, kind: 'kit', shared };
    }
  }
  return undefined;
}

/**
 * The project's own notice host anywhere in the source folder, or KumiCraft's ToastHost in a file
 * every page renders (a ToastHost on another page does not show on this one).
 */
export function findToastHost(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<ToastHostFound | undefined> {
  return findHostIn({ fs, root, count: 0 }, sourceDir.replace(/\/+$/, ''), 0);
}

/**
 * A Library block that brings KumiCraft's Toast kit is refused in a project with its own notice
 * system, like "show a notice on click" (QA K9.8-1).
 */
export async function checkToastKitInsert(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  components: readonly string[] | undefined,
): Promise<Result<void>> {
  if (!components?.some((c) => c === 'ToastTrigger' || c === 'ToastHost')) return ok(undefined);
  const library = await projectToastLibrary(fs, root);
  if (library !== undefined) {
    return err({ code: 'E023', params: { reason: 'projectToastLibrary', library } });
  }
  const host = await findToastHost(fs, root, sourceDir);
  if (host?.kind === 'other') {
    return err({ code: 'E023', params: { reason: 'projectToastHost', file: host.file } });
  }
  return ok(undefined);
}

/**
 * Before "show a notice on click": refused when the project has its own notice system; otherwise
 * whether KumiCraft's ToastHost already shows on every page from another file (a layout).
 */
export async function toastProjectState(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  file: string,
): Promise<Result<{ readonly hostElsewhere: boolean }>> {
  const check = await checkToastKitInsert(fs, root, sourceDir, ['ToastTrigger']);
  if (!check.ok) return check;
  const host = await findToastHost(fs, root, sourceDir);
  return ok({ hostElsewhere: host !== undefined && host.file !== file });
}
