// Vite + React framework adapter implementation (SPEC-04 section 1, M-FW).
import type { FrameworkAdapter } from '../types.ts';
import { detectViteReact } from './detect.ts';

export const viteReactAdapter: FrameworkAdapter = {
  id: 'vite-react',
  primaryDependency: 'vite',
  detect: detectViteReact,
  sourceExtensions: ['.jsx', '.tsx'],
  markupExtensions: ['.jsx', '.tsx'],
  editMode: 'full',
  buildCheck: 'vite',
  requiredPackages: ['vite', 'react'],
  runner: {
    entry: 'runners/vite-react',
    options: (ctx) => ({ ...ctx, host: '127.0.0.1' }),
  },
  template: 'vite-react-ts-tailwind4',
};
