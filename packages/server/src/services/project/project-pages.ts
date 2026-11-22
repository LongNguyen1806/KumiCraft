// The pages of the open project (03b section 1.4): from the stack's meta-framework (Next.js files),
// else from the runtime's own routes (Express), else from the view language's route list (React).
import { err, ok, type PagesInfo, type Result, type SupportReport } from '@kumicraft/shared';

import type { PagesContext, ProjectStack } from '../../kernel/stacks.ts';
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
