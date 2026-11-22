// The Vite runtime (SPEC-04 M-FW): the project's own Vite dev server, with the Bridge plugin.
import type { RuntimeAdapter } from '../../../kernel/stacks.ts';
import { detectViteReact, VITE_MAJORS } from './detect.ts';

export const viteRuntime: RuntimeAdapter = {
  id: 'vite',
  primaryDependency: 'vite',
  supportedMajors: VITE_MAJORS,
  stampHost: 'buildPlugin',
  detect: detectViteReact,
  buildCheck: 'vite',
  requiredPackages: ['vite', 'react'],
  runner: {
    entry: 'runners/vite-react',
    options: (ctx) => ({ ...ctx, host: '127.0.0.1' }),
  },
  template: 'vite-react-ts-tailwind4',
};
