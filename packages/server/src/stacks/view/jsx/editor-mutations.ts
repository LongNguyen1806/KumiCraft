// Editor mutations, guarded by the view language's Capability (ADR-A5, SPEC-04, WP-4.00).
import type {
  AttributeLevelEdit,
  EditResult,
  Result,
  SourceEdit,
  StructureEdit,
} from '@kumicraft/shared';
import { err } from '@kumicraft/shared';

import type { WrittenFile } from '../../../kernel/editing.ts';
import type { CapabilityReason } from '../../../kernel/stacks.ts';
import { executeEditBatch } from './edit-batch.ts';
import type { SnippetFormatter } from './snippet-format.ts';
import type { SourceEditorConfig, SourceEditorDeps } from './source-editor-types.ts';
import { executeStructureEdit } from './structure/structure-runner.ts';

export function resolveSourcePaths(deps: SourceEditorDeps, config: SourceEditorConfig) {
  return {
    getSourceDir: () => {
      if (config.sourceDir !== undefined) return config.sourceDir;
      // A view-only project (Express + Pug) keeps its markup in its own views folder.
      const view = deps.getView?.();
      const viewOnly = view !== undefined && !view.capability.edit;
      return viewOnly ? (deps.getProjectSourceDir?.() ?? 'views') : 'src';
    },
    getMarkupExtensions: () => {
      const view = deps.getView?.();
      if (view !== undefined && view.markupExtensions.length > 0) return view.markupExtensions;
      return config.sourceExtensions ?? ['.jsx', '.tsx'];
    },
    getSourceExtensions: () => {
      const view = deps.getView?.();
      return view !== undefined
        ? view.sourceExtensions
        : (config.sourceExtensions ?? ['.jsx', '.tsx']);
    },
  };
}

export type ApplyEditFn = (
  root: string,
  edit: SourceEdit,
  cb?: (file: WrittenFile) => void,
) => Promise<Result<EditResult>>;

/** Why the open project's view language cannot be edited, or undefined when it can (ADR-A5). */
function cannotEdit(deps: SourceEditorDeps): CapabilityReason | undefined {
  const capability = deps.getView?.().capability;
  return capability === undefined || capability.edit ? undefined : capability.reason;
}

export function createEditorMutations(
  deps: SourceEditorDeps,
  paths: ReturnType<typeof resolveSourcePaths>,
  formatSnippet: SnippetFormatter,
  applyEditFn: ApplyEditFn,
) {
  const isViewOnly = () => cannotEdit(deps) !== undefined;
  const viewOnlyErr = () =>
    Promise.resolve(
      err({ code: 'E023' as const, params: { reason: cannotEdit(deps) ?? 'viewOnly' } }),
    );

  return {
    applyEdit: (root: string, edit: SourceEdit, cb?: (file: WrittenFile) => void) =>
      isViewOnly() ? viewOnlyErr() : applyEditFn(root, edit, cb),
    applyStructureEdit: (
      root: string,
      edit: StructureEdit,
      cb?: (files: readonly WrittenFile[]) => void,
    ) =>
      isViewOnly()
        ? viewOnlyErr()
        : executeStructureEdit(
            deps.fs,
            root,
            paths.getSourceDir(),
            paths.getSourceExtensions(),
            edit,
            cb,
            formatSnippet,
            deps.styling,
            deps.newCssDir,
          ),
    applyEditBatch: (
      root: string,
      edits: readonly AttributeLevelEdit[],
      cb?: (files: readonly WrittenFile[]) => void,
    ) =>
      isViewOnly()
        ? viewOnlyErr()
        : executeEditBatch(
            deps.fs,
            root,
            paths.getSourceDir(),
            paths.getSourceExtensions(),
            edits,
            cb,
          ),
  };
}
