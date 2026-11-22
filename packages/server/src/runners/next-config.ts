// Adds the stamping loader to the config Next.js reads from the user's next.config (03b section
// 1.2), without touching the file: Turbopack rules (Next 16 default) and a webpack rule (Next 14
// and 15 default). Next uses the one of the bundler it runs; the user's own rules are kept.
import Module from 'node:module';

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec => typeof value === 'object' && Boolean(value);

/**
 * The files Turbopack runs through the loader. `.js` (what create-next-app writes for JavaScript)
 * skips the packages (`foreign` is node_modules), so they do not all go through the loader.
 */
const TURBOPACK_RULES = {
  '*.tsx': {},
  '*.jsx': {},
  '*.js': { condition: { not: 'foreign' } },
} as const;

function turbopackRule(existing: unknown, loader: string, extra: object): unknown {
  if (existing === undefined) return { ...extra, loaders: [loader] };
  // A user rule for the same files: ours runs first on the source (last in the list, as webpack).
  if (Array.isArray(existing)) {
    const list: unknown[] = existing;
    return [...list, loader];
  }
  const loaders: unknown = isRecord(existing) ? existing['loaders'] : undefined;
  if (isRecord(existing) && Array.isArray(loaders)) {
    const list: unknown[] = loaders;
    return { ...existing, loaders: [...list, loader] };
  }
  return existing;
}

function withTurbopack(config: Rec, loader: string): Rec {
  const turbopack = isRecord(config['turbopack']) ? config['turbopack'] : {};
  const rules = isRecord(turbopack['rules']) ? turbopack['rules'] : {};
  const added = Object.fromEntries(
    Object.entries(TURBOPACK_RULES).map(([g, extra]) => [
      g,
      turbopackRule(rules[g], loader, extra),
    ]),
  );
  return { ...turbopack, rules: { ...rules, ...added } };
}

function withWebpack(userWebpack: unknown, loader: string) {
  return (webpackConfig: unknown, context: unknown): unknown => {
    const out: unknown =
      typeof userWebpack === 'function'
        ? Reflect.apply(userWebpack, undefined, [webpackConfig, context])
        : webpackConfig;
    if (isRecord(out) && isRecord(out['module']) && Array.isArray(out['module']['rules'])) {
      const rule = {
        test: /\.(js|jsx|tsx)$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [{ loader }],
      };
      out['module']['rules'].unshift(rule);
    }
    return out;
  };
}

/** The config Next reads, with the loader added for both bundlers. */
export function withStampLoader(config: unknown, loader: string): unknown {
  if (!isRecord(config)) return config;
  return {
    ...config,
    turbopack: withTurbopack(config, loader),
    webpack: withWebpack(config['webpack'], loader),
  };
}

const CONFIG_MODULE = '/next/dist/server/config.js';

/** Next's config module with its `default` (load the config) returning the stamped config. */
export function wrapConfigModule(exported: unknown, loader: string): unknown {
  if (!isRecord(exported)) return exported;
  const load = exported['default'];
  if (typeof load !== 'function') return exported;
  return {
    ...exported,
    __esModule: true,
    default: async (...args: unknown[]): Promise<unknown> =>
      withStampLoader(await Reflect.apply(load, undefined, args), loader),
  };
}

/**
 * Wraps Next's config module when Node first loads it. Its `default` is a getter, so it cannot be
 * reassigned (03a section 2). Returns a check that says whether Next loaded it (if not, Next moved
 * the file and the pages carry no stamp: the runner says so).
 */
export function hookNextConfig(loader: string): () => boolean {
  const load: unknown = Reflect.get(Module, '_load');
  const resolveName: unknown = Reflect.get(Module, '_resolveFilename');
  if (typeof load !== 'function' || typeof resolveName !== 'function') return () => false;
  let wrapped: unknown;
  Reflect.set(Module, '_load', function hooked(this: unknown, ...args: unknown[]): unknown {
    const exported: unknown = Reflect.apply(load, this, args);
    let file: unknown;
    try {
      file = Reflect.apply(resolveName, Module, args);
    } catch {
      return exported;
    }
    if (typeof file !== 'string' || !file.replaceAll('\\', '/').endsWith(CONFIG_MODULE))
      return exported;
    wrapped ??= wrapConfigModule(exported, loader);
    return wrapped;
  });
  return () => wrapped !== undefined;
}
