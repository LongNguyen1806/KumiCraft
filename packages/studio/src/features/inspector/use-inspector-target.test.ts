// Tests for useInspectorTarget, lock detection, warnings, and scope prefix calculation.
import type { ElementSource, Frame } from '@kumicraft/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import { ApiError } from '../../api/http.ts';
import * as sourceClient from '../../api/source-client.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import {
  computeWritePrefix,
  deriveLockReason,
  deriveWarnings,
  useInspectorTarget,
} from './use-inspector-target.ts';

const mockDesktopFrame: Frame = {
  id: 'desktop',
  label: 'Desktop',
  width: 1440,
  height: 900,
};

const mockMobileFrame: Frame = {
  id: 'mobile',
  label: 'Mobile',
  width: 375,
  height: 667,
};

const mockElementSource: ElementSource = {
  loc: 'src/App.tsx:12:5',
  tag: 'div',
  fileHash: 'a'.repeat(64),
  className: { kind: 'static', value: 'flex p-4' },
  text: { kind: 'none' },
  attributes: {},
  inLoop: false,
};

describe('useInspectorTarget and helpers [SPEC-04 section 9 M-IN]', () => {
  beforeEach(() => {
    vi.spyOn(eventsClient, 'createEventsClient').mockReturnValue({
      close: vi.fn(),
      isConnected: () => true,
    });
    vi.spyOn(sourceClient, 'fetchElementSource').mockResolvedValue(mockElementSource);
    useSelectionStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('computeWritePrefix', () => {
    it('returns empty string for base scope without state', () => {
      expect(computeWritePrefix({ breakpoint: 'base' }, 'desktop-first')).toBe('');
      expect(computeWritePrefix({ breakpoint: 'base' }, 'mobile-first')).toBe('');
    });

    it('returns max-<bp>: for desktop-first and <bp>: for mobile-first', () => {
      expect(computeWritePrefix({ breakpoint: 'sm' }, 'desktop-first')).toBe('max-sm:');
      expect(computeWritePrefix({ breakpoint: 'md' }, 'mobile-first')).toBe('md:');
    });

    it('combines responsive and interaction state correctly', () => {
      expect(computeWritePrefix({ breakpoint: 'sm', state: 'hover' }, 'desktop-first')).toBe(
        'max-sm:hover:',
      );
      expect(computeWritePrefix({ breakpoint: 'md', state: 'focus' }, 'mobile-first')).toBe(
        'md:focus:',
      );
      expect(computeWritePrefix({ breakpoint: 'base', state: 'disabled' }, 'desktop-first')).toBe(
        'disabled:',
      );
    });
  });

  describe('deriveLockReason', () => {
    it('detects outsideSource and tooLarge readonly states', () => {
      expect(deriveLockReason({ ...mockElementSource, readonly: 'outsideSource' })).toEqual({
        lockReason: 'outsideSource',
      });
      expect(deriveLockReason({ ...mockElementSource, readonly: 'tooLarge' })).toEqual({
        lockReason: 'tooLarge',
      });
    });

    it('detects expression and duplicate class names', () => {
      expect(
        deriveLockReason({
          ...mockElementSource,
          className: { kind: 'expression', code: 'cn("flex", active && "bold")' },
        }),
      ).toEqual({ lockReason: 'classExpression', lockCode: 'cn("flex", active && "bold")' });

      expect(
        deriveLockReason({
          ...mockElementSource,
          className: { kind: 'duplicate' },
        }),
      ).toEqual({ lockReason: 'classDuplicate' });
    });

    it('returns empty for static classes', () => {
      expect(deriveLockReason(mockElementSource)).toEqual({});
    });
  });

  describe('deriveWarnings', () => {
    it('generates warnings for component usages > 1', () => {
      const warnings = deriveWarnings({
        ...mockElementSource,
        component: { name: 'Card', usages: 3 },
      });
      expect(warnings).toEqual([{ kind: 'usages', count: 3, name: 'Card' }]);
    });

    it('generates warnings for loops and instances > 1', () => {
      expect(deriveWarnings({ ...mockElementSource, inLoop: true })).toEqual([
        { kind: 'loop', count: 2 },
      ]);
      expect(deriveWarnings(mockElementSource, 4)).toEqual([{ kind: 'loop', count: 4 }]);
    });
  });

  describe('useInspectorTarget hook', () => {
    it('returns empty when no element is selected', () => {
      const { result } = renderHook(() => useInspectorTarget());
      expect(result.current.kind).toBe('empty');
    });

    it('returns multi when more than 1 element is selected', () => {
      act(() => {
        useSelectionStore.getState().setSelectedRefs([
          { loc: 'src/App.tsx:10:2', index: 0 },
          { loc: 'src/App.tsx:15:4', index: 0 },
        ]);
      });
      const { result } = renderHook(() => useInspectorTarget());
      expect(result.current.kind).toBe('multi');
    });

    it('fetches source and computes scope for a single selected element', async () => {
      act(() => {
        useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:12:5', index: 0 }]);
        useSelectionStore.getState().setSelectionInfo([
          {
            ref: { loc: 'src/App.tsx:12:5', index: 0 },
            found: true,
            tag: 'div',
            instances: 1,
          },
        ]);
      });

      const { result } = renderHook(() =>
        useInspectorTarget({
          frame: mockMobileFrame,
          primaryFrame: mockDesktopFrame,
          responsiveMode: 'desktop-first',
        }),
      );

      await waitFor(() => {
        expect(result.current.kind).toBe('element');
        if (result.current.kind === 'element') {
          expect(result.current.loading).toBe(false);
          expect(result.current.source).toEqual(mockElementSource);
        }
      });

      if (result.current.kind === 'element') {
        // Edits reach every screen (spec-log #141); the frame's band is kept for "only this screen".
        expect(result.current.currentScope.breakpoint).toBe('base');
        expect(result.current.writePrefix).toBe('');
        expect(result.current.frameBreakpoint).toBe('sm');

        const target = result.current;
        act(() => {
          target.setInteractionState('hover');
        });
      }

      if (result.current.kind === 'element') {
        expect(result.current.currentScope.state).toBe('hover');
        expect(result.current.writePrefix).toBe('hover:');
      }
    });

    it('keeps the shown source while the same element reloads after a save', async () => {
      act(() => {
        useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:12:5', index: 0 }]);
      });
      const { result } = renderHook(() => useInspectorTarget());
      await waitFor(() => {
        expect(result.current.kind === 'element' && result.current.loading).toBe(false);
      });

      vi.spyOn(sourceClient, 'fetchElementSource').mockReturnValue(new Promise(() => undefined));
      const target = result.current;
      act(() => {
        if (target.kind === 'element') target.refresh();
      });

      expect(result.current.kind === 'element' && result.current.loading).toBe(true);
      expect(result.current.kind === 'element' && result.current.source).toEqual(mockElementSource);
    });

    it('starts another element on Default, not on the state picked for the last one [R-IN-14] (hand test step 14)', async () => {
      act(() => {
        useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:12:5', index: 0 }]);
      });
      const { result } = renderHook(() => useInspectorTarget());
      act(() => {
        if (result.current.kind === 'element') result.current.setInteractionState('hover');
      });
      expect(result.current.kind === 'element' && result.current.interactionState).toBe('hover');
      act(() => {
        useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:20:5', index: 0 }]);
      });
      await waitFor(() => {
        expect(result.current.kind === 'element' && result.current.interactionState).toBe(
          undefined,
        );
      });
    });

    it('reads again when the element just moved under it, and shows no error [R-IN-10] (tour 01)', async () => {
      const fetch = vi
        .spyOn(sourceClient, 'fetchElementSource')
        .mockRejectedValueOnce(new ApiError(409, 'E017', { reason: 'moved' }))
        .mockResolvedValue(mockElementSource);
      act(() => {
        useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:12:5', index: 0 }]);
      });
      const { result } = renderHook(() => useInspectorTarget());
      await waitFor(() => {
        expect(result.current.kind === 'element' && result.current.source).toEqual(
          mockElementSource,
        );
      });
      expect(result.current.kind === 'element' && result.current.error).toBe(undefined);
      // The refused read was followed by another one (the hook may read more on re-render).
      expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('shows a lasting failure in words, not as the raw request error [R-IN-10] (tour 01)', async () => {
      vi.spyOn(sourceClient, 'fetchElementSource').mockRejectedValue(
        new ApiError(422, 'E023', { reason: 'tooLarge' }),
      );
      act(() => {
        useSelectionStore.getState().setSelectedRefs([{ loc: 'src/App.tsx:12:5', index: 0 }]);
      });
      const { result } = renderHook(() => useInspectorTarget());
      await waitFor(() => {
        expect(result.current.kind === 'element' && result.current.error).toMatch(/\(E023\)$/);
      });
      const target = result.current;
      expect(target.kind === 'element' ? target.error : '').not.toContain('API request failed');
    });
  });
});
