// Unit tests for useAttributeEdit hook (SPEC-04 R-IN-18, FR-25).
import type { EditResult, ElementSource } from '@kumicraft/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/http.ts';
import * as sourceClient from '../../api/source-client.ts';
import { initI18n } from '../../i18n/i18n.ts';
import type { InspectorTarget } from './types.ts';
import { useAttributeEdit } from './use-attribute-edit.ts';

const linkSource: ElementSource = {
  loc: 'src/App.tsx:8:5',
  tag: 'a',
  fileHash: 'a'.repeat(64),
  className: { kind: 'static', value: '' },
  text: { kind: 'static', value: 'Docs' },
  attributes: { href: { kind: 'static', value: '/old' } },
  inLoop: false,
};

function createTarget(
  source: ElementSource,
  refresh: () => void,
): Extract<InspectorTarget, { readonly kind: 'element' }> {
  return {
    kind: 'element',
    ref: { loc: source.loc, index: 0 },
    source,
    loading: false,
    currentScope: { breakpoint: 'base' },
    writePrefix: '',
    warnings: [],
    setInteractionState: vi.fn(),
    refresh,
  };
}

const okResult: EditResult = {
  changed: true,
  file: 'src/App.tsx',
  fileHash: 'b'.repeat(64),
  element: { ...linkSource, attributes: { href: { kind: 'static', value: '/new' } } },
};

describe('useAttributeEdit [R-IN-18]', () => {
  beforeAll(async () => {
    await initI18n();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a setAttribute edit with the current value as before, then refreshes', async () => {
    const editSpy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue(okResult);
    const refresh = vi.fn();
    const { result } = renderHook(() => useAttributeEdit(createTarget(linkSource, refresh)));

    act(() => {
      result.current.setAttribute('href', '/new');
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(editSpy).toHaveBeenCalledWith({
      edit: {
        kind: 'setAttribute',
        loc: 'src/App.tsx:8:5',
        tag: 'a',
        name: 'href',
        before: '/old',
        after: '/new',
      },
    });
    expect(result.current.error).toBeUndefined();
    expect(result.current.isSaving).toBe(false);
  });

  it('sends after undefined to remove an attribute and before undefined for a new one', async () => {
    const editSpy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue(okResult);
    const { result } = renderHook(() => useAttributeEdit(createTarget(linkSource, vi.fn())));

    act(() => {
      result.current.setAttribute('href', undefined);
    });
    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });
    act(() => {
      result.current.setAttribute('alt', 'Logo');
    });
    await waitFor(() => {
      expect(editSpy).toHaveBeenCalledTimes(2);
    });

    expect(editSpy.mock.calls[0]?.[0].edit).toMatchObject({ name: 'href', before: '/old' });
    expect(editSpy.mock.calls[0]?.[0].edit).not.toHaveProperty('after', expect.anything());
    expect(editSpy.mock.calls[1]?.[0].edit).toMatchObject({ name: 'alt', after: 'Logo' });
    expect(editSpy.mock.calls[1]?.[0].edit).not.toHaveProperty('before', expect.anything());
  });

  it('skips the request when the value is unchanged or the attribute is an expression', () => {
    const editSpy = vi.spyOn(sourceClient, 'editSource').mockResolvedValue(okResult);
    const source: ElementSource = {
      ...linkSource,
      tag: 'img',
      attributes: {
        src: { kind: 'expression', code: 'logoUrl' },
        alt: { kind: 'static', value: 'Logo' },
      },
    };
    const { result } = renderHook(() => useAttributeEdit(createTarget(source, vi.fn())));

    act(() => {
      result.current.setAttribute('alt', 'Logo');
      result.current.setAttribute('src', '/a.png');
    });

    expect(editSpy).not.toHaveBeenCalled();
  });

  it('shows the conflict message and refreshes on E017', async () => {
    vi.spyOn(sourceClient, 'editSource').mockRejectedValue(new ApiError(409, 'E017'));
    const refresh = vi.fn();
    const { result } = renderHook(() => useAttributeEdit(createTarget(linkSource, refresh)));

    act(() => {
      result.current.setAttribute('href', '/new');
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('shows the generic failure message without refreshing on other errors', async () => {
    vi.spyOn(sourceClient, 'editSource').mockRejectedValue(new ApiError(422, 'E023'));
    const refresh = vi.fn();
    const { result } = renderHook(() => useAttributeEdit(createTarget(linkSource, refresh)));

    act(() => {
      result.current.setAttribute('href', '/new');
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
