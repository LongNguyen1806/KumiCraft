// The Express runtime (SPEC-04 section 1, Phase 4 K4): the project's own server behind a proxy that
// puts the Bridge into its HTML; Pug views are stamped by a compiler hook.
import type { RuntimeAdapter } from '../../../kernel/stacks.ts';
import { detectExpressPug } from './detect.ts';
import { findExpressRoutes } from './routes.ts';

export * from './detect.ts';
export * from './routes.ts';

function shouldRestartOn(relPath: string): boolean {
  const normalized = relPath.replaceAll('\\', '/');
  if (!/\.(js|cjs|mjs)$/i.test(normalized)) {
    return false;
  }
  return !normalized.startsWith('views/') && !normalized.startsWith('public/');
}

export const expressRuntime: RuntimeAdapter = {
  id: 'express',
  primaryDependency: 'express',
  stampHost: 'templateHook',
  detect: detectExpressPug,
  buildCheck: 'pug',
  requiredPackages: ['express', 'pug'],
  runner: {
    entry: 'runners/express-pug',
    options: (ctx) => ({
      ...ctx,
      host: '127.0.0.1',
    }),
  },
  restartOn: shouldRestartOn,
  pages: (ctx) =>
    findExpressRoutes(
      ctx.fs,
      ctx.root,
      ctx.support.serverEntry ?? 'app.js',
      ctx.support.viewsDir ?? 'views',
    ),
};
