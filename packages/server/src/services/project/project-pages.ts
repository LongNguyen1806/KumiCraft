// The pages of the open project (03b section 1.4): from the stack's meta-framework (Next.js files),
// else from the runtime's own routes (Express), else from the view language's route list (React).
import {
  err,
  ok,
  type PagesInfo,
  type Result,
  type StructureResult,
  type SupportReport,
} from '@kumicraft/shared';

import type { PageEditDeps, ProjectFeatures } from '../../kernel/features.ts';
import type { PagesContext, PagesProvider, ProjectStack } from '../../kernel/stacks.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';

export type OpenProject = {
  readonly root: string;
  readonly support: SupportReport;
  readonly file: { readonly sourceDir: string };
};

export async function readStackPages(
  stack: ProjectStack,
  open: OpenProject,
  fs: FileSystemPort,
): Promise<Result<PagesInfo>> {
  const ctx: PagesContext = {
    fs,
    root: open.root,
    support: open.support,
    sourceDir: open.file.sourceDir,
    serverEntry: open.support.serverEntry,
    viewsDir: open.support.viewsDir,
  };
  if (stack.pages !== undefined) return ok(await stack.pages.read(ctx));
  if (stack.runtime.pages !== undefined) return ok(await stack.runtime.pages(ctx));
  const features = stack.view.features?.project;
  if (features === undefined) return err({ code: 'E023', params: { reason: 'viewOnly' } });
  return ok(await features.readPages(fs, open.root, open.file.sourceDir));
}

export type ViaStack = (
  pages: PagesProvider,
  deps: PageEditDeps,
) => Promise<Result<StructureResult>>;
export type ViaFeatures = (
  features: ProjectFeatures,
  deps: PageEditDeps,
) => Promise<Result<StructureResult>>;

/**
 * A page edit: by the stack's own pages (Next.js files, Razor Pages, MVC, Express routes) when it
 * has them, needing only an editable project; else by the JSX view's route list.
 */
export function editPages(
  current: { readonly stack: ProjectStack; readonly open: boolean },
  pageDeps: () => Result<PageEditDeps>,
  projectTools: () => Result<{ deps: PageEditDeps; features: ProjectFeatures }>,
  viaStack: ViaStack,
  viaFeatures: ViaFeatures,
): Promise<Result<StructureResult>> {
  const pages = current.stack.pages;
  if (pages === undefined) {
    const tools = projectTools();
    return tools.ok ? viaFeatures(tools.value.features, tools.value.deps) : Promise.resolve(tools);
  }
  const capability = current.stack.view.capability;
  if (current.open && !capability.edit) {
    return Promise.resolve(err({ code: 'E023', params: { reason: capability.reason } }));
  }
  const deps = pageDeps();
  return deps.ok ? viaStack(pages, deps.value) : Promise.resolve(deps);
}
