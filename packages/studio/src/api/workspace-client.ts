// Typed REST workspace client for Studio (SPEC-03 section 10.3, SPEC-04.1 section 6, ADR-FE-17).
import type {
  CreateWorkspaceRequest,
  DesignDocument,
  OperationBatch,
  WorkspaceMeta,
} from '@reactcraft/model';

import { apiGet, apiPost } from './http.ts';
import type { SessionInfo } from './session.ts';

export type DocumentResponse = {
  readonly document: DesignDocument;
  readonly revision: number;
};

export type ApplyOperationsResponse = {
  readonly revision: number;
  readonly idMap: Record<string, string>;
};

export type BackupSummary = {
  readonly id: string;
  readonly file: string;
  readonly createdAt: string;
};

export async function fetchDocument(): Promise<DocumentResponse> {
  const data = await apiGet('workspace/document');
  return data as DocumentResponse;
}

/** The document when the workspace opened, otherwise the session (still in error). */
export type ReopenResponse = Partial<DocumentResponse> & { readonly session?: SessionInfo };

export async function reloadWorkspace(): Promise<ReopenResponse> {
  const data = await apiPost('workspace/reload');
  return data as ReopenResponse;
}

export async function createWorkspace(payload: CreateWorkspaceRequest): Promise<WorkspaceMeta> {
  const data = await apiPost('workspace', payload);
  return data as WorkspaceMeta;
}

export async function sendOperations(batch: OperationBatch): Promise<ApplyOperationsResponse> {
  const data = await apiPost('workspace/operations', batch);
  return data as ApplyOperationsResponse;
}

export async function fetchBackups(): Promise<readonly BackupSummary[]> {
  const data = await apiGet('workspace/backups');
  return (data as { backups: BackupSummary[] }).backups;
}

export async function restoreBackup(id: string): Promise<ReopenResponse> {
  const data = await apiPost(`workspace/backups/${encodeURIComponent(id)}/restore`);
  return data as ReopenResponse;
}

export async function setWorkspaceTrust(trusted: boolean): Promise<SessionInfo> {
  const data = await apiPost('workspace/trust', { trusted });
  return data as SessionInfo;
}
