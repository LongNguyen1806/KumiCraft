// Assets client (WP-2.09a, R-DT-13, R-DT-14).
import {
  type InsertImageEdit,
  type ProjectAssets,
  ProjectAssetsSchema,
  type StructureResult,
} from '@reactcraft/shared';

import { apiGet } from './http.ts';
import { applyStructureEdit } from './source-client.ts';

export async function fetchAssets(): Promise<ProjectAssets> {
  const result = await apiGet('project/assets');
  return ProjectAssetsSchema.parse(result);
}

export async function insertImage(edit: InsertImageEdit): Promise<StructureResult> {
  return applyStructureEdit(edit);
}
