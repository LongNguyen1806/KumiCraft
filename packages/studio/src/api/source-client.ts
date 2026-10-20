import {
  type BatchEditRequest,
  type BatchEditResult,
  BatchEditResultSchema,
  type EditResult,
  EditResultSchema,
  type ElementSource,
  ElementSourceSchema,
  type ElementText,
  ElementTextSchema,
  parseLocString,
  type SourceEdit,
  type StructureEdit,
  type StructureResult,
  StructureResultSchema,
} from '@reactcraft/shared';

import { apiGet, apiPost, parseResponse } from './http.ts';

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
  return parseResponse(ElementSourceSchema, await apiGet(`source/element?${query.toString()}`));
}

export async function fetchElementSourceByLoc(loc: string): Promise<ElementSource | undefined> {
  const parsed = parseLocString(loc);
  if (!parsed) return undefined;
  return fetchElementSource(parsed);
}

export async function fetchElementText(loc: string): Promise<ElementText> {
  const query = new URLSearchParams({ loc });
  return parseResponse(ElementTextSchema, await apiGet(`source/element-text?${query.toString()}`));
}

export async function editSource(request: SingleFileEditRequest): Promise<EditResult> {
  return parseResponse(EditResultSchema, await apiPost('source/edits', request));
}

export async function editSourceBatch(request: BatchEditRequest): Promise<BatchEditResult> {
  return parseResponse(BatchEditResultSchema, await apiPost('source/edits/batch', request));
}

export async function applyStructureEdit(edit: StructureEdit): Promise<StructureResult> {
  return parseResponse(StructureResultSchema, await apiPost('source/edits', { edit }));
}
