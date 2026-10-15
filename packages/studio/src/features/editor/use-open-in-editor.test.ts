import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpenInEditor } from './use-open-in-editor.ts';

type Call = { readonly url: string; readonly method: string; readonly body: unknown };
let calls: Call[];

function stubServer(status: number, body?: unknown) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: JSON.parse((init?.body as string | undefined) ?? 'null') as unknown,
      });
      const text = body === undefined ? undefined : JSON.stringify(body);
      return Promise.resolve(new Response(text, { status }));
    }),
  );
}

beforeEach(() => {
  sessionStorage.setItem('reactcraft.sessionToken', 'tok');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOpenInEditor', () => {
  it('asks the server to open the element position, never a vscode:// link [R-SL-06]', async () => {
    stubServer(204);
    const open = vi.spyOn(window, 'open');
    const { result } = renderHook(() => useOpenInEditor());

    act(() => {
      result.current.open('src/pages/Home.tsx:12:7');
    });

    await vi.waitFor(() => {
      expect(calls).toEqual([
        { url: '/api/v1/open-in-editor', method: 'POST', body: { loc: 'src/pages/Home.tsx:12:7' } },
      ]);
    });
    expect(open).not.toHaveBeenCalled();
    expect(result.current.errorCode).toBeUndefined();
  });

  it('keeps the error code when the editor is not installed', async () => {
    stubServer(409, { error: { code: 'E021', params: { missing: 'editor' } } });
    const { result } = renderHook(() => useOpenInEditor());

    act(() => {
      result.current.open('src/pages/Home.tsx:1:1');
    });

    await vi.waitFor(() => {
      expect(result.current.errorCode).toBe('E021');
    });
  });
});
