// Express + Pug framework adapter implementation (SPEC-04 section 1, Phase 4 K4).
import type { FrameworkAdapter } from '../types.ts';
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

export const expressPugAdapter: FrameworkAdapter = {
  id: 'express-pug',
  primaryDependency: 'express',
  detect: detectExpressPug,
  sourceExtensions: [],
  markupExtensions: ['.pug'],
  editMode: 'viewOnly',
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
