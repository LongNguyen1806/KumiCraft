// Draft preview page served by the Bridge plugin on the dev server (SPEC-04 M-DR, R-DR-12).
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, posix } from 'node:path';

/** Canvas URL of a draft: `/__kumicraft/draft?file=<RelPath>` (R-DR-12, R-DR-13). */
export const DRAFT_PAGE_PATH = '/__kumicraft/draft';
/** Module the draft page loads; the file rides in the path so Vite never strips it as a query. */
export const DRAFT_ENTRY_PREFIX = '/@kumicraft/draft-entry/';
const DRAFT_ENTRY_ID_PREFIX = '\0kumicraft-draft-entry/';

const DRAFT_EXTENSIONS = ['.tsx', '.jsx'] as const;

export type DraftPageOptions = {
  readonly rootDir: string;
  /** Project-relative drafts folder (`designDirs.drafts`). */
  readonly draftsDir: string;
  /** Project-relative global CSS entries (`SupportReport.styling.globalCss`, Round S1). */
  readonly globalCss?: readonly string[] | undefined;
};

type NextFunction = (err?: unknown) => void;
export type DraftMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => void;

/** The part of Vite's dev server the draft page needs. */
export type DraftDevServer = {
  readonly middlewares: { use(handler: DraftMiddleware): unknown };
  transformIndexHtml(url: string, html: string): Promise<string>;
};

/**
 * A project-relative `.tsx`/`.jsx` path inside the drafts folder, or undefined (R-DR-12: anything
 * else answers 404). Rejects absolute paths, backslashes and `..` segments.
 */
export function draftFileInDir(file: string | undefined, draftsDir: string): string | undefined {
  if (file === undefined || file.length === 0 || file.includes('\\') || file.includes('\0')) {
    return undefined;
  }
  if (file.startsWith('/') || /^[A-Za-z]:/.test(file)) return undefined;
  if (file.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')) {
    return undefined;
  }
  const dir = posix.normalize(draftsDir).replace(/\/+$/, '');
  if (!file.startsWith(`${dir}/`)) return undefined;
  return DRAFT_EXTENSIONS.some((ext) => file.endsWith(ext)) ? file : undefined;
}

/** `react-router-dom` first (its own `MemoryRouter`), then `react-router` v7, else none. */
export async function detectRouterPackage(rootDir: string): Promise<string | undefined> {
  let pkg: unknown;
  try {
    pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'));
  } catch {
    return undefined;
  }
  const names = new Set<string>();
  if (pkg instanceof Object) {
    for (const field of ['dependencies', 'devDependencies'] as const) {
      const deps: unknown = Reflect.get(pkg, field);
      if (deps instanceof Object) for (const name of Object.keys(deps)) names.add(name);
    }
  }
  if (names.has('react-router-dom')) return 'react-router-dom';
  return names.has('react-router') ? 'react-router' : undefined;
}

export function draftPageHtml(file: string): string {
  const name = posix.basename(file).replace(/\.[jt]sx$/, '');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>${escapeHtml(name)}</title>`,
    '  </head>',
    '  <body>',
    '    <div id="root"></div>',
    `    <script type="module" src="${DRAFT_ENTRY_PREFIX}${encodeURIComponent(file)}"></script>`,
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${String(ch.charCodeAt(0))};`);
}

/**
 * Entry module of the draft page: the project's Tailwind CSS, the draft's component (default
 * export, else its first exported function) under `MemoryRouter` when the project has a router.
 * The `main.tsx` providers do not apply (R-DR-12); a component that needs one fails at runtime
 * and the Bridge reports it like any page error (R-RN-25).
 */
export function draftEntryCode(input: {
  readonly file: string;
  readonly globalCss?: readonly string[] | undefined;
  readonly routerPackage?: string | undefined;
}): string {
  const lines: string[] = [];
  if (input.globalCss !== undefined) {
    for (const css of input.globalCss) {
      lines.push(`import ${JSON.stringify(`/${css}`)};`);
    }
  }
  lines.push("import { createElement } from 'react';");
  lines.push("import { createRoot } from 'react-dom/client';");
  if (input.routerPackage !== undefined) {
    lines.push(`import { MemoryRouter } from ${JSON.stringify(input.routerPackage)};`);
  }
  lines.push(`import * as draftModule from ${JSON.stringify(`/${input.file}`)};`);
  lines.push(
    "const Draft = draftModule.default ?? Object.values(draftModule).find((value) => typeof value === 'function');",
    "const container = document.getElementById('root');",
    'if (Draft === undefined) {',
    `  throw new Error(${JSON.stringify(`${input.file} has no exported component`)});`,
    '}',
    'if (container) {',
    input.routerPackage === undefined
      ? '  createRoot(container).render(createElement(Draft));'
      : '  createRoot(container).render(createElement(MemoryRouter, null, createElement(Draft)));',
    '}',
    '',
  );
  return lines.join('\n');
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function sendNotFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

/** Vite middleware answering `/__kumicraft/draft`; every other URL goes on to Vite. */
export function createDraftMiddleware(
  options: DraftPageOptions,
  server: Pick<DraftDevServer, 'transformIndexHtml'>,
): DraftMiddleware {
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== DRAFT_PAGE_PATH) {
      next();
      return;
    }
    void (async () => {
      const file = draftFileInDir(url.searchParams.get('file') ?? undefined, options.draftsDir);
      if (file === undefined || !(await isFile(join(options.rootDir, file)))) {
        sendNotFound(res);
        return;
      }
      // Vite adds its client, the React preamble and the Bridge tags (transformIndexHtml).
      const html = await server.transformIndexHtml(req.url ?? DRAFT_PAGE_PATH, draftPageHtml(file));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(html);
    })().catch(next);
  };
}

/** `/@kumicraft/draft-entry/<file>` → virtual id, only for a file inside the drafts folder. */
export function resolveDraftEntryId(id: string, draftsDir: string): string | undefined {
  if (!id.startsWith(DRAFT_ENTRY_PREFIX)) return undefined;
  let file: string;
  try {
    file = decodeURIComponent(id.slice(DRAFT_ENTRY_PREFIX.length));
  } catch {
    return undefined;
  }
  const inDir = draftFileInDir(file, draftsDir);
  return inDir === undefined ? undefined : `${DRAFT_ENTRY_ID_PREFIX}${inDir}`;
}

/** Draft file of a virtual entry id from `resolveDraftEntryId`, else undefined. */
export function draftFileOfEntryId(id: string, draftsDir: string): string | undefined {
  if (!id.startsWith(DRAFT_ENTRY_ID_PREFIX)) return undefined;
  return draftFileInDir(id.slice(DRAFT_ENTRY_ID_PREFIX.length), draftsDir);
}

/** Plugin hooks of the draft page; with no drafts folder they do nothing (R-DR-12). */
export function createDraftPageHooks(options: {
  readonly rootDir: string;
  readonly draftsDir?: string | undefined;
  readonly globalCss?: readonly string[] | undefined;
}) {
  const { rootDir, draftsDir, globalCss } = options;
  let routerPackage: Promise<string | undefined> | undefined;
  const entryCode = async (file: string): Promise<string> => {
    routerPackage ??= detectRouterPackage(rootDir);
    return draftEntryCode({ file, globalCss, routerPackage: await routerPackage });
  };

  return {
    // Added before Vite's own middlewares, so its SPA fallback never answers the draft URL.
    configureServer(server: DraftDevServer): void {
      if (draftsDir === undefined) return;
      server.middlewares.use(createDraftMiddleware({ rootDir, draftsDir, globalCss }, server));
    },

    resolveId(id: string): string | undefined {
      return draftsDir === undefined ? undefined : resolveDraftEntryId(id, draftsDir);
    },

    /** Undefined for any other module, so Vite's other loaders get it. */
    load(id: string): Promise<string> | undefined {
      const file = draftsDir === undefined ? undefined : draftFileOfEntryId(id, draftsDir);
      if (file === undefined) return undefined;
      return entryCode(file);
    },
  };
}
