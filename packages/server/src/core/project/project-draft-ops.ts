// Draft operations for ProjectService (SPEC-04 M-DF, WP-4.00).
import {
  type CreateDraft,
  type DraftFile,
  type DraftsInfo,
  ok,
  type PromoteDraft,
  type RenameDraft,
  type Result,
  type StructureResult,
} from '@kumicraft/shared';

import { promoteDraft } from './draft-promote.ts';
import { createDraft, deleteDraft, duplicateDraft, listDrafts, renameDraft } from './drafts.ts';
import type { PageEditDeps } from './page-common.ts';
import type { WorkspaceState } from './project-types.ts';

export function handleListDrafts(
  current: WorkspaceState,
  deps: Result<PageEditDeps>,
): Promise<Result<DraftsInfo>> | Result<DraftsInfo> {
  if (current.status === 'open' && current.support.editMode === 'viewOnly') {
    return ok({ drafts: [], dir: '', ignored: false });
  }
  return deps.ok ? listDrafts(deps.value) : deps;
}

export function handleCreateDraft(
  deps: Result<PageEditDeps>,
  input: CreateDraft,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return deps.ok ? createDraft(deps.value, input) : deps;
}

export function handleRenameDraft(
  deps: Result<PageEditDeps>,
  input: RenameDraft,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return deps.ok ? renameDraft(deps.value, input) : deps;
}

export function handleDuplicateDraft(
  deps: Result<PageEditDeps>,
  input: DraftFile,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return deps.ok ? duplicateDraft(deps.value, input) : deps;
}

export function handleDeleteDraft(
  deps: Result<PageEditDeps>,
  input: DraftFile,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return deps.ok ? deleteDraft(deps.value, input) : deps;
}

export function handlePromoteDraft(
  deps: Result<PageEditDeps>,
  input: PromoteDraft,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return deps.ok ? promoteDraft(deps.value, input) : deps;
}
