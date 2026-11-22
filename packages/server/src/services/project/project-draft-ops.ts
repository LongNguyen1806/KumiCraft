// Draft operations for ProjectService (SPEC-04 M-DF, WP-4.00), done by the view language's project
// tools (docs/architecture/03 section 3.2).
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

import type { PageEditDeps, ProjectFeatures } from '../../kernel/features.ts';
import type { Capability } from '../../kernel/stacks.ts';

/** The project tools of the open project's view language, with what they need. */
export type ProjectTools = { readonly deps: PageEditDeps; readonly features: ProjectFeatures };

export function handleListDrafts(
  capability: Capability,
  tools: Result<ProjectTools>,
): Promise<Result<DraftsInfo>> | Result<DraftsInfo> {
  // A view language without an editor has no drafts to list (ADR-A5).
  if (!capability.edit) {
    return ok({ drafts: [], dir: '', ignored: false });
  }
  return tools.ok ? tools.value.features.listDrafts(tools.value.deps) : tools;
}

export function handleCreateDraft(
  tools: Result<ProjectTools>,
  input: CreateDraft,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return tools.ok ? tools.value.features.createDraft(tools.value.deps, input) : tools;
}

export function handleRenameDraft(
  tools: Result<ProjectTools>,
  input: RenameDraft,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return tools.ok ? tools.value.features.renameDraft(tools.value.deps, input) : tools;
}

export function handleDuplicateDraft(
  tools: Result<ProjectTools>,
  input: DraftFile,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return tools.ok ? tools.value.features.duplicateDraft(tools.value.deps, input) : tools;
}

export function handleDeleteDraft(
  tools: Result<ProjectTools>,
  input: DraftFile,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return tools.ok ? tools.value.features.deleteDraft(tools.value.deps, input) : tools;
}

export function handlePromoteDraft(
  tools: Result<ProjectTools>,
  input: PromoteDraft,
): Promise<Result<StructureResult>> | Result<StructureResult> {
  return tools.ok ? tools.value.features.promoteDraft(tools.value.deps, input) : tools;
}
