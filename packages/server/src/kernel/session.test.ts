import { describe, expect, it } from 'vitest';

import { err, ok } from './result.ts';
import {
  createSessionInfoProvider,
  type ProjectState,
  toPublicError,
  toSupportedPlatform,
} from './session.ts';

describe('createSessionInfoProvider', () => {
  it('reads the project state again on every call', () => {
    let project: ProjectState = { state: 'none', suggestedPath: '/tmp/a' };
    const getSessionInfo = createSessionInfoProvider({
      version: '1.2.3',
      platform: 'linux',
      features: ['ai'],
      readProject: () => project,
    });

    const first = getSessionInfo();
    project = { state: 'error', error: { code: 'E003' } };
    const second = getSessionInfo();

    expect(first).toEqual({
      version: '1.2.3',
      platform: 'linux',
      features: ['ai'],
      project: { state: 'none', suggestedPath: '/tmp/a' },
    });
    expect(second.project).toEqual({ state: 'error', error: { code: 'E003' } });
  });
});

describe('toPublicError', () => {
  it('drops the server-only cause', () => {
    const error = { code: 'E003' as const, params: { file: 'x' }, cause: new Error('disk') };

    expect(toPublicError(error)).toEqual({ code: 'E003', params: { file: 'x' } });
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
