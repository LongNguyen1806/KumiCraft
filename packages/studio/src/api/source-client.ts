// Source Editor REST client (SPEC-03 section 5.5, R-SE-01..13).
import type { EditRequest, EditResult, ElementSource } from '@reactcraft/shared';

import { apiGet, apiPost } from './http.ts';

export type FetchElementSourceParams = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
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

export async function editSource(request: EditRequest): Promise<EditResult> {
  const result = await apiPost('source/edits', request);
  return result as EditResult;
}
