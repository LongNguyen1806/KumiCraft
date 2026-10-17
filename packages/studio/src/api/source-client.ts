// Source Editor REST client (SPEC-03 section 5.5, R-SE-01..13, R-SE-22..29).
import {
  type EditResult,
  type ElementSource,
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

export async function editSource(request: SingleFileEditRequest): Promise<EditResult> {
  const result = await apiPost('source/edits', request);
  return result as EditResult;
}

export async function applyStructureEdit(edit: StructureEdit): Promise<StructureResult> {
  const result = await apiPost('source/edits', { edit });
  return StructureResultSchema.parse(result);
}
