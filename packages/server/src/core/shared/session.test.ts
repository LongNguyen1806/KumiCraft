import { describe, expect, it } from 'vitest';

import { err, ok } from './result.ts';
import { createSessionInfoProvider, toSupportedPlatform, type WorkspaceState } from './session.ts';

describe('createSessionInfoProvider', () => {
  it('reads the workspace state again on every call', () => {
    let workspace: WorkspaceState = { state: 'none', directory: '/tmp/a' };
    const getSessionInfo = createSessionInfoProvider({
      version: '1.2.3',
      platform: 'linux',
      features: ['ai'],
      readWorkspace: () => workspace,
    });

    const first = getSessionInfo();
    workspace = { state: 'error', error: { code: 'E003' } };
    const second = getSessionInfo();

    expect(first).toEqual({
      version: '1.2.3',
      platform: 'linux',
      features: ['ai'],
      workspace: { state: 'none', directory: '/tmp/a' },
    });
    expect(second.workspace).toEqual({ state: 'error', error: { code: 'E003' } });
  });
});

describe('toSupportedPlatform', () => {
  it('keeps the three supported platforms and rejects the others', () => {
    expect(['win32', 'darwin', 'linux', 'aix'].map(toSupportedPlatform)).toEqual([
      'win32',
      'darwin',
      'linux',
      undefined,
    ]);
  });
});

describe('result helpers', () => {
  it('builds success and failure results', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err({ code: 'E013' })).toEqual({ ok: false, error: { code: 'E013' } });
  });
});
