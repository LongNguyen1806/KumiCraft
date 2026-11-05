// Editor mutations setup with viewOnly guard (SPEC-04, WP-4.00).
import type {
  AttributeLevelEdit,
  EditResult,
  Result,
  SourceEdit,
  StructureEdit,
} from '@kumicraft/shared';
import { err } from '@kumicraft/shared';

import { executeEditBatch } from './edit-batch.ts';
import type { SnippetFormatter } from './snippet-format.ts';
import type { SourceEditorConfig, SourceEditorDeps, WrittenFile } from './source-editor-service.ts';
import { executeStructureEdit } from './structure/structure-runner.ts';

export function resolveSourcePaths(deps: SourceEditorDeps, config: SourceEditorConfig) {
  return {
    getSourceDir: () => {
      if (config.sourceDir !== undefined) return config.sourceDir;
      // A view-only project (Express + Pug) keeps its markup in its own views folder.
      const viewOnly = deps.getAdapter?.().editMode === 'viewOnly';
      return viewOnly ? (deps.getProjectSourceDir?.() ?? 'views') : 'src';
    },
    getMarkupExtensions: () => {
      const adapter = deps.getAdapter?.();
      if (adapter?.markupExtensions !== undefined && adapter.markupExtensions.length > 0) {
        return adapter.markupExtensions;
      }
      return config.sourceExtensions ?? ['.jsx', '.tsx'];
    },
    getSourceExtensions: () => {
      const adapter = deps.getAdapter?.();
      return adapter !== undefined
        ? adapter.sourceExtensions
        : (config.sourceExtensions ?? ['.jsx', '.tsx']);
    },
  };
}

export type ApplyEditFn = (
  root: string,
  edit: SourceEdit,
  cb?: (file: WrittenFile) => void,
) => Promise<Result<EditResult>>;

export function createEditorMutations(
  deps: SourceEditorDeps,
  paths: ReturnType<typeof resolveSourcePaths>,
  formatSnippet: SnippetFormatter,
  applyEditFn: ApplyEditFn,
) {
  const isViewOnly = () => deps.getAdapter?.().editMode === 'viewOnly';
  const viewOnlyErr = () =>
    Promise.resolve(err({ code: 'E023' as const, params: { reason: 'viewOnly' } }));

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
