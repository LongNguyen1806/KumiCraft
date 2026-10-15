// Tests for useInspectorTarget, lock detection, warnings, and scope prefix calculation.
import type { ElementSource, Frame } from '@reactcraft/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as eventsClient from '../../api/events-client.ts';
import * as sourceClient from '../../api/source-client.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
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

    it('returns multiple when more than 1 element is selected', () => {
      act(() => {
        useSelectionStore.getState().setSelectedRefs([
          { loc: 'src/App.tsx:10:2', index: 0 },
          { loc: 'src/App.tsx:15:4', index: 0 },
        ]);
      });
      const { result } = renderHook(() => useInspectorTarget());
      expect(result.current.kind).toBe('multiple');
      if (result.current.kind === 'multiple') {
        expect(result.current.count).toBe(2);
      }
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
        expect(result.current.currentScope.breakpoint).toBe('sm');
        expect(result.current.writePrefix).toBe('max-sm:');

        const target = result.current;
        act(() => {
          target.setInteractionState('hover');
        });
      }

      if (result.current.kind === 'element') {
        expect(result.current.currentScope.state).toBe('hover');
        expect(result.current.writePrefix).toBe('max-sm:hover:');
      }
    });
  });
});
