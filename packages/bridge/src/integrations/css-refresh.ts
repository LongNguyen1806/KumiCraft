// A source file created while the dev server runs (a new draft, a new component, a kit file) gets
// its classes into the CSS like a file that was there at start (the owner's report, 2026-11-18).
// Tailwind's Vite plugin watches the files it found on its last scan and skips the event of a
// created one, so until the CSS is generated again, nothing in the new file ever gets CSS. The
// project's CSS modules are reloaded when a source file appears: Tailwind scans again and from
// then on watches the new file like the others.
import { extname, relative, sep } from 'node:path';

type CssModule = { readonly file?: unknown };

/** The parts of Vite's dev server this uses (Vite 5 to 8). */
export type CssRefreshServer = {
  readonly watcher: { on(event: 'add', listener: (file: string) => void): unknown };
  readonly moduleGraph: { readonly idToModuleMap: ReadonlyMap<string, CssModule> };
  reloadModule(module: CssModule): Promise<void>;
};

const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.styl', '.pcss']);
const WAIT_MS = 60;

function isInside(rootDir: string, sourceDir: string, file: string): boolean {
  const rel = relative(rootDir, file).split(sep).join('/');
  return rel === sourceDir || rel.startsWith(`${sourceDir}/`);
}

/** Reloads the CSS modules the page uses whenever a source file is created under `sourceDir`. */
export function watchCreatedSources(
  server: CssRefreshServer,
  options: { readonly rootDir: string; readonly sourceDir: string },
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const reloadCss = () => {
    timer = undefined;
    for (const module of server.moduleGraph.idToModuleMap.values()) {
      const file = module.file;
      if (typeof file === 'string' && STYLE_EXTENSIONS.has(extname(file))) {
        void server.reloadModule(module);
      }
    }
  };
  server.watcher.on('add', (file) => {
    if (STYLE_EXTENSIONS.has(extname(file))) return; // a new stylesheet is imported, not scanned
    if (!isInside(options.rootDir, options.sourceDir, file)) return;
    // Several files at once (a kit, a component and its page): one reload for all of them.
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(reloadCss, WAIT_MS);
  });
}
