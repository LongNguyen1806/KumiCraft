// The Next.js runtime (03b section 1.2): the project's own Next dev server, run by KumiCraft's
// runner, with the stamping loader added to its config and the Bridge put in by a proxy.
import type { RuntimeAdapter } from '../../../kernel/stacks.ts';
import { detectNextReact } from './detect.ts';

export const nextRuntime: RuntimeAdapter = {
  id: 'next',
  primaryDependency: 'next',
  stampHost: 'buildPlugin',
  detect: detectNextReact,
  requiredPackages: ['next', 'react'],
  runner: {
    entry: 'runners/next-react',
    options: (ctx) => ({ ...ctx, host: '127.0.0.1' }),
  },
};
