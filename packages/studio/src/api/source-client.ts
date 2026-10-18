import {
  type BatchEditRequest,
  type BatchEditResult,
  BatchEditResultSchema,
  type EditResult,
  type ElementSource,
  type ElementText,
  ElementTextSchema,
  type SourceEdit,
  type StructureEdit,
  type StructureResult,
  StructureResultSchema,
} from '@reactcraft/shared';

import { apiGet, apiPost } from './http.ts';

export type FetchElementSourceParams = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

export type SingleFileEditRequest = {
  readonly edit: SourceEdit;
  readonly coalesceKey?: string | undefined;
};

export async function fetchElementSource(params: FetchElementSourceParams): Promise<ElementSource> {
  const loc = `${params.file}:${String(params.line)}:${String(params.column)}`;
  const query = new URLSearchParams({
    loc,
    file: params.file,
    line: String(params.line),
    column: String(params.column),
  });
  const result = await apiGet(`source/element?${query.toString()}`);
  return result as ElementSource;
}

export async function fetchElementText(loc: string): Promise<ElementText> {
  const query = new URLSearchParams({ loc });
  const result = await apiGet(`source/element-text?${query.toString()}`);
  return ElementTextSchema.parse(result);
}

export async function editSource(request: SingleFileEditRequest): Promise<EditResult> {
  const result = await apiPost('source/edits', request);
  return result as EditResult;
}

export async function editSourceBatch(request: BatchEditRequest): Promise<BatchEditResult> {
  const result = await apiPost('source/edits/batch', request);
  return BatchEditResultSchema.parse(result);
}

export async function applyStructureEdit(edit: StructureEdit): Promise<StructureResult> {
  const result = await apiPost('source/edits', { edit });
  return StructureResultSchema.parse(result);
}
