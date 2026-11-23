// The combination table (docs/architecture/03 section 3.4): which runtime runs which view
// language. The first row is the default for a folder that is not a project yet. Only the
// composition root (index.ts, server-services.ts) imports this file.
import type { ProjectStack, StackTable } from '../kernel/stacks.ts';
import { mvcPages } from './meta/mvc/index.ts';
import { nextPages } from './meta/next/index.ts';
import { razorPagesPages } from './meta/razor-pages/index.ts';
import { dotnetMvcRuntime, dotnetRazorPagesRuntime } from './runtime/dotnet/index.ts';
import { expressPugPages, expressRuntime } from './runtime/express/index.ts';
import { nextRuntime } from './runtime/next/index.ts';
import { viteRuntime } from './runtime/vite/index.ts';
import { jsxView } from './view/jsx/view.ts';
import { pugView } from './view/pug/view.ts';
import { razorView } from './view/razor/view.ts';

export const viteReactStack: ProjectStack = {
  id: 'vite-react',
  runtime: viteRuntime,
  view: jsxView,
};
export const expressPugStack: ProjectStack = {
  id: 'express-pug',
  runtime: expressRuntime,
  view: pugView,
  pages: expressPugPages,
};

/** Next.js (03b section 1): its own runtime, the JSX editor, and pages read from its folders. */
export const nextReactStack: ProjectStack = {
  id: 'next-react',
  runtime: nextRuntime,
  view: jsxView,
  pages: nextPages,
};

/** ASP.NET Core (03c): a stamped copy run by `dotnet watch`, the Razor editor, its pages. */
export const aspnetRazorPagesStack: ProjectStack = {
  id: 'aspnet-razor-pages',
  runtime: dotnetRazorPagesRuntime,
  view: razorView,
  pages: razorPagesPages,
};
export const aspnetMvcStack: ProjectStack = {
  id: 'aspnet-mvc',
  runtime: dotnetMvcRuntime,
  view: razorView,
  pages: mvcPages,
};

export const STACKS: StackTable = [
  viteReactStack,
  expressPugStack,
  nextReactStack,
  aspnetRazorPagesStack,
  aspnetMvcStack,
];
