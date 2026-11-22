// The loader Turbopack and webpack run on a Next.js project's JSX (03b section 1.2): the same
// `data-rc-loc` / `data-rc-use` stamp as the Vite plugin, from the Bridge's transform. Built as a
// CommonJS file (dist/runners/next-loader.cjs): both bundlers load loaders with `require`.
import { transformJsx } from '@kumicraft/bridge';

type LoaderContext = {
  readonly resourcePath: string;
  readonly callback?: (error: undefined, code: string, map?: unknown) => void;
};

export default function kumicraftStampLoader(
  this: LoaderContext,
  source: string,
): string | undefined {
  const root = process.env['KUMICRAFT_STAMP_ROOT'];
  if (root === undefined) return source;
  const sourceDir = process.env['KUMICRAFT_STAMP_SOURCE_DIR'] ?? 'src';
  const out = transformJsx(source, this.resourcePath, { rootDir: root, sourceDir });
  if (out === undefined) return source;
  if (this.callback === undefined) return out.code;
  this.callback(undefined, out.code, out.map);
  return undefined;
}
