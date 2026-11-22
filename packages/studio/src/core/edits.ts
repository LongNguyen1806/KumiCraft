// The one way a feature sends an edit to the server (03 section 6.2): attribute and class edits
// (classes as intents, ADR-A4), structure edits and style changes. Features never call the edit
// endpoints themselves; lint checks it.
import type {
  BatchEditRequest,
  BatchEditResult,
  EditResult,
  StructureEdit,
  StructureResult,
  StyleApplyRequest,
  StyleApplyResult,
} from '@kumicraft/shared';

import {
  applyStructureEdit,
  editSource,
  editSourceBatch,
  type SingleFileEditRequest,
} from '../api/source-client.ts';
import { applyStyle } from '../api/style-client.ts';

/** One edit of one element: one Undo step. */
export function sendEdit(request: SingleFileEditRequest): Promise<EditResult> {
  return editSource(request);
}

/** Several edits written together: one Undo step. */
export function sendEdits(request: BatchEditRequest): Promise<BatchEditResult> {
  return editSourceBatch(request);
}

/** Insert, remove, move, wrap… */
export function sendStructureEdit(edit: StructureEdit): Promise<StructureResult> {
  return applyStructureEdit(edit);
}

/** A change made in a stylesheet (CSS, CSS Modules, Sass, Less, Bootstrap). */
export function sendStyleChange(request: StyleApplyRequest): Promise<StyleApplyResult> {
  return applyStyle(request);
}
