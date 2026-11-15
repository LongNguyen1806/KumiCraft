// Assets client (WP-2.09a, R-DT-13, R-DT-14).
import {
  type InsertImageEdit,
  type ProjectAssets,
  ProjectAssetsSchema,
  type StructureResult,
} from '@kumicraft/shared';

import { apiGet, apiGetBlob, parseResponse } from './http.ts';
import { applyStructureEdit } from './source-client.ts';

export async function fetchAssets(): Promise<ProjectAssets> {
  return parseResponse(ProjectAssetsSchema, await apiGet('project/assets'));
}

/**
 * One image of public/ for a thumbnail, through the Studio server: the Studio may not load images
 * from the Canvas port (S-11), but it may show a `blob:` URL.
 */
export function fetchProjectImage(file: string): Promise<Blob> {
  return apiGetBlob(`project/assets/file?path=${encodeURIComponent(file)}`);
}

export async function insertImage(edit: InsertImageEdit): Promise<StructureResult> {
  return applyStructureEdit(edit);
}
