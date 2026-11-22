// The combination table (docs/architecture/03 section 3.4): which runtime runs which view
// language. The first row is the default for a folder that is not a project yet. Only the
// composition root (index.ts, server-services.ts) imports this file.
import type { ProjectStack, StackTable } from '../kernel/stacks.ts';
import { expressRuntime } from './runtime/express/index.ts';
import { viteRuntime } from './runtime/vite/index.ts';
import { jsxView } from './view/jsx/view.ts';
import { pugView } from './view/pug/view.ts';

export const viteReactStack: ProjectStack = {
  id: 'vite-react',
  runtime: viteRuntime,
  view: jsxView,
};
export const expressPugStack: ProjectStack = {
  id: 'express-pug',
  runtime: expressRuntime,
  view: pugView,
};

export const STACKS: StackTable = [viteReactStack, expressPugStack];
