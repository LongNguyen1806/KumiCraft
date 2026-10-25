import {
  type FileCreate,
  type FileDelete,
  type FileImporters,
  FileImportersSchema,
  type FileRename,
  type FileTreeListing,
  FileTreeListingSchema,
} from '@kumicraft/shared';

import { apiDelete, apiGet, apiPost, parseResponse } from './http.ts';

export async function fetchFileTree(dir?: string): Promise<FileTreeListing> {
  const query = dir !== undefined && dir !== '' ? `?dir=${encodeURIComponent(dir)}` : '';
  return parseResponse(FileTreeListingSchema, await apiGet(`project/tree${query}`));
}

export async function createProjectFile(data: FileCreate): Promise<void> {
  await apiPost('project/files', data);
}

export async function renameProjectFile(data: FileRename): Promise<void> {
  await apiPost('project/files/rename', data);
}

export async function deleteProjectFile(data: FileDelete): Promise<void> {
  await apiDelete('project/files', data);
}

export async function fetchFileImporters(path: string): Promise<FileImporters> {
  return parseResponse(
    FileImportersSchema,
    await apiGet(`project/files/importers?path=${encodeURIComponent(path)}`),
  );
}
