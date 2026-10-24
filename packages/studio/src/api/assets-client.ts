// Assets client (WP-2.09a, R-DT-13, R-DT-14).
import {
  type InsertImageEdit,
  type ProjectAssets,
  ProjectAssetsSchema,
  type StructureResult,
} from '@kumicraft/shared';

import { apiGet, parseResponse } from './http.ts';
import { applyStructureEdit } from './source-client.ts';

export async function fetchAssets(): Promise<ProjectAssets> {
  return parseResponse(ProjectAssetsSchema, await apiGet('project/assets'));
}

export async function insertImage(edit: InsertImageEdit): Promise<StructureResult> {
  return applyStructureEdit(edit);
}
