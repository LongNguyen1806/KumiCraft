// Unit tests for typed workspace REST client (SPEC-03 section 10.3).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './http.ts';
import {
  createWorkspace,
  fetchBackups,
  fetchDocument,
  reloadWorkspace,
  restoreBackup,
  sendOperations,
  setWorkspaceTrust,
} from './workspace-client.ts';

describe('workspace-client', () => {
  beforeEach(() => {
    sessionStorage.setItem('reactcraft.sessionToken', 'test-token-123');
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('fetchDocument calls /api/v1/workspace/document with Bearer token', async () => {
    const mockDoc = { workspace: { name: 'Test' }, pages: {} };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { document: mockDoc, revision: 3 } }),
    } as Response);

    const res = await fetchDocument();
    expect(res.revision).toBe(3);
    expect(res.document).toEqual(mockDoc);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/workspace/document', {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer test-token-123',
      },
    });
  });

  it('fetchDocument throws ApiError on 500 error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { code: 'E014', message: 'Server error' } }),
    } as Response);

    await expect(fetchDocument()).rejects.toThrow(ApiError);
  });

  it('sendOperations sends batch with POST and handles 409 conflict error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: { code: 'E017', message: 'Revision mismatch' } }),
    } as Response);

    const batch = {
      baseRevision: 2,
      ops: [],
      meta: { source: 'user' as const, label: 'conflict-test' },
    };
    await expect(sendOperations(batch)).rejects.toThrow(ApiError);
  });

  it('sendOperations succeeds with 200 and returns new revision and idMap', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { revision: 4, idMap: { tmp: 'real_id' } } }),
    } as Response);

    const batch = {
      baseRevision: 3,
      ops: [],
      meta: { source: 'user' as const, label: 'success-test' },
    };
    const res = await sendOperations(batch);
    expect(res.revision).toBe(4);
    expect(res.idMap).toEqual({ tmp: 'real_id' });
  });

  it('setWorkspaceTrust sends POST /api/v1/workspace/trust', async () => {
    const mockSession = {
      version: '1.0.0',
      workspace: { state: 'open' as const, id: 'w1', name: 'W1', revision: 1, trusted: true },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockSession }),
    } as Response);

    const res = await setWorkspaceTrust(true);
    expect(res).toEqual(mockSession);
  });

  it('reloadWorkspace, createWorkspace, fetchBackups, and restoreBackup send proper requests', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { document: {}, revision: 5 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'new_ws', name: 'New' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { backups: [{ id: 'b1', file: 'b1.json', createdAt: '2026' }] },
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { document: {}, revision: 6 } }),
      } as Response);

    const reloadRes = await reloadWorkspace();
    expect(reloadRes.revision).toBe(5);

    const createRes = await createWorkspace({ name: 'New', responsiveMode: 'desktop-first' });
    expect(createRes.id).toBe('new_ws');

    const backupsRes = await fetchBackups();
    expect(backupsRes).toHaveLength(1);

    const restoreRes = await restoreBackup('b1');
    expect(restoreRes.revision).toBe(6);
  });

  it('rejects with network error when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));
    await expect(fetchDocument()).rejects.toThrow('Network failure');
  });
});
