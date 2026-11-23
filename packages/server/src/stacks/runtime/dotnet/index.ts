// The ASP.NET runtime (docs/architecture/03c): the project's stamped copy run by `dotnet watch`,
// behind the Bridge proxy. One runtime per view kind, so the combination table tells a Razor
// Pages project from an MVC one; both share the runner.
import type { RuntimeAdapter } from '../../../kernel/stacks.ts';
import { detectRazor, type RazorKind } from './detect.ts';

export * from './detect.ts';

function dotnetRuntime(kind: RazorKind): RuntimeAdapter {
  return {
    id: 'dotnet',
    primaryDependency: 'dotnet',
    stampHost: 'shadowCopy',
    detect: (input) => detectRazor(input, kind),
    // The first start builds the Razor helper and the project (03c section 3.1).
    startupTimeoutMs: 300_000,
    // A Tailwind project's CLI comes from its own package.json; the SDK is checked by the runner.
    requiredPackages: [],
    runner: {
      entry: 'runners/dotnet-razor',
      options: (ctx) => ({ ...ctx, host: '127.0.0.1' }),
    },
  };
}

export const dotnetRazorPagesRuntime = dotnetRuntime('pages');
export const dotnetMvcRuntime = dotnetRuntime('mvc');
