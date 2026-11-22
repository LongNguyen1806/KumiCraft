// The stamping loader is added to the config Next reads, for Turbopack and webpack, and the user's
// own config is kept (03b section 1.2).
import { describe, expect, it } from 'vitest';

import { withStampLoader, wrapConfigModule } from './next-config.ts';

const LOADER = '/kc/next-loader.cjs';

describe('Next.js config with the stamping loader [03b section 1.2]', () => {
  it('adds Turbopack rules and a webpack pre-rule, keeping the user options and webpack function', () => {
    const userWebpack = (config: { module: { rules: unknown[] }; tag?: string }) => ({
      ...config,
      tag: 'user',
    });
    const out = withStampLoader(
      {
        poweredByHeader: false,
        turbopack: { rules: { '*.svg': { loaders: ['@svgr/webpack'], as: '*.js' } } },
        webpack: userWebpack,
      },
      LOADER,
    );

    expect(out).toMatchObject({
      poweredByHeader: false,
      turbopack: {
        rules: {
          '*.svg': { loaders: ['@svgr/webpack'], as: '*.js' },
          '*.tsx': { loaders: [LOADER] },
          '*.jsx': { loaders: [LOADER] },
        },
      },
    });
    const webpack: unknown = Reflect.get(Object(out), 'webpack');
    if (typeof webpack !== 'function') throw new Error('no webpack function');
    const built: unknown = Reflect.apply(webpack, undefined, [
      { module: { rules: [{ test: /x/ }] } },
      {},
    ]);
    expect(built).toMatchObject({
      tag: 'user',
      module: {
        rules: [
          { enforce: 'pre', exclude: /node_modules/, use: [{ loader: LOADER }] },
          { test: /x/ },
        ],
      },
    });
  });

  it("wraps the config module's loader and keeps its other exports", async () => {
    const wrapped = wrapConfigModule(
      { default: () => Promise.resolve({ reactStrictMode: true }), normalizeConfig: 'kept' },
      LOADER,
    );

    expect(Reflect.get(Object(wrapped), 'normalizeConfig')).toBe('kept');
    const load: unknown = Reflect.get(Object(wrapped), 'default');
    if (typeof load !== 'function') throw new Error('no default');
    const config: unknown = await Reflect.apply(load, undefined, ['phase', '/dir']);
    expect(config).toMatchObject({
      reactStrictMode: true,
      turbopack: { rules: { '*.tsx': { loaders: [LOADER] } } },
    });
  });
});
