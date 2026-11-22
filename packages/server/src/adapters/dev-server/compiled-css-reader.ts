// Reads a stylesheet as the project's Vite dev server compiles it (`?direct`), source map included
// since the Bridge plugin turns on `css.devSourcemap` (R-ST-04).
import type { CompiledCssPort } from '../../ports/compiled-css-port.ts';

const TIMEOUT_MS = 2_000;
const MAX_BYTES = 8 * 1024 * 1024;

/** `D:/app/src/a.scss?used` → `/@fs/D:/app/src/a.scss?direct` (Vite serves any file by `/@fs/`). */
export function compiledCssUrl(origin: string, sheetId: string): string {
  const path = (sheetId.split('?')[0] ?? sheetId).replaceAll('\\', '/');
  const absolute = path.startsWith('/') ? path : `/${path}`;
  return new URL(`/@fs${encodeURI(absolute)}?direct`, origin).href;
}

export function createCompiledCssReader(origin: () => string | undefined): CompiledCssPort {
  return {
    async read(sheetId) {
      const base = origin();
      if (base === undefined) return undefined;
      try {
        const response = await fetch(compiledCssUrl(base, sheetId), {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return undefined;
        const text = await response.text();
        return text.length > MAX_BYTES ? undefined : text;
      } catch {
        return undefined;
      }
    },
  };
}
