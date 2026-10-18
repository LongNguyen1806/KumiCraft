// Tests for clipboard copy, cut, paste (SPEC-04 M-CB, Scenarios #9..#12).
import type { ElementRef, TreeNode } from '@reactcraft/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sourceClient from '../../api/source-client.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import {
  copySelection,
  cutSelection,
  pasteClipboard,
  sortRefsInDocumentOrder,
} from './clipboard-actions.ts';
import { useClipboardStore } from './clipboard-store.ts';

describe('Studio Clipboard (Scenarios #9..#12) [R-CB-10..13]', () => {
  const ref1: ElementRef = { loc: 'src/App.tsx:3:5', index: 0 };
  const ref2: ElementRef = { loc: 'src/App.tsx:4:7', index: 0 };
  const refOther: ElementRef = { loc: 'src/Header.tsx:2:3', index: 0 };

  const treeNodes: TreeNode[] = [
    { ref: ref1, tag: 'div', instances: 1 },
    { ref: ref2, tag: 'span', instances: 1, parent: 0 },
  ];

  beforeEach(() => {
    useSelectionStore.getState().reset();
    useClipboardStore.getState().clear();
    useStructureErrorStore.getState().clearError();
    useSelectionStore.getState().setTree(treeNodes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sortRefsInDocumentOrder orders by treeNodes DOM position and keeps others at end', () => {
    const unknownRef: ElementRef = { loc: 'src/Other.tsx:1:1', index: 0 };
    const sorted = sortRefsInDocumentOrder([unknownRef, ref2, ref1], treeNodes);
    expect(sorted).toEqual([ref1, ref2, unknownRef]);
  });

  it('Scenario 9: copySelection with 2 refs in same file, reverse DOM selection order, writeText fails [R-CB-10]', async () => {
    useSelectionStore.getState().setSelectedRefs([ref2, ref1]);

    vi.spyOn(sourceClient, 'fetchElementText').mockImplementation((loc: string) => {
      if (loc === ref1.loc) {
        return Promise.resolve({
          jsx: '<div className="first"/>',
          file: 'src/App.tsx',
          imports: ['import { Card } from "./Card";'],
        });
      }
      return Promise.resolve({
        jsx: '<span className="second"/>',
        file: 'src/App.tsx',
        imports: ['import { Card } from "./Card";', 'import { Badge } from "./Badge";'],
      });
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Focus in iframe - write denied')),
        readText: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    const result = await copySelection();
    expect(result).toBe(true);

    const entry = useClipboardStore.getState().entry;
    expect(entry).toBeDefined();
    expect(entry?.text).toBe('<div className="first"/>\n<span className="second"/>');
    expect(entry?.from?.file).toBe('src/App.tsx');
    expect(entry?.from?.imports).toEqual([
      'import { Card } from "./Card";',
      'import { Badge } from "./Badge";',
    ]);
  });

  it('Scenario 10: copySelection with 2 refs across different files has no from metadata [R-CB-10]', async () => {
    useSelectionStore.getState().setSelectedRefs([ref1, refOther]);

    vi.spyOn(sourceClient, 'fetchElementText').mockImplementation((loc: string) => {
      if (loc === ref1.loc) {
        return Promise.resolve({ jsx: '<div/>', file: 'src/App.tsx', imports: [] });
      }
      return Promise.resolve({ jsx: '<header/>', file: 'src/Header.tsx', imports: [] });
    });

    const result = await copySelection();
    expect(result).toBe(true);

    const entry = useClipboardStore.getState().entry;
    expect(entry).toBeDefined();
    expect(entry?.text).toBe('<div/>\n<header/>');
    expect(entry?.from).toBeUndefined();
  });

  it('Scenario 11: pasteClipboard scenarios (a, b, c, d) [R-CB-11, R-CB-12]', async () => {
    const applySpy = vi
      .spyOn(sourceClient, 'applyStructureEdit')
      .mockResolvedValue({ changed: true, files: ['src/App.tsx'], locs: ['src/App.tsx:5:5'] });

    useClipboardStore.getState().setEntry({
      text: '<Card/>',
      from: { file: 'src/Card.tsx', imports: ['import { Card } from "./Card";'] },
    });

    // (d) When nothing is selected, returns false and does not call server
    useSelectionStore.getState().setSelectedRefs([]);
    const resD = await pasteClipboard();
    expect(resD).toBe(false);
    expect(applySpy).not.toHaveBeenCalled();

    // (a) readText throws -> uses entry.text and entry.from; section is container -> child end
    const sectionRef: ElementRef = { loc: 'src/App.tsx:10:1', index: 0 };
    useSelectionStore.getState().setTree([{ ref: sectionRef, tag: 'section', instances: 1 }]);
    useSelectionStore.getState().setSelectedRefs([sectionRef]);

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: vi.fn().mockRejectedValue(new Error('Denied')),
        writeText: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    const resA = await pasteClipboard();
    expect(resA).toBe(true);
    expect(applySpy).toHaveBeenLastCalledWith({
      kind: 'insert',
      target: {
        kind: 'child',
        parent: { loc: sectionRef.loc, tag: 'section' },
        where: 'end',
      },
      jsx: '<Card/>',
      from: { file: 'src/Card.tsx', imports: ['import { Card } from "./Card";'] },
    });

    // (b) readText returns different text -> pastes plain text, from is undefined
    const pRef: ElementRef = { loc: 'src/App.tsx:12:1', index: 0 };
    useSelectionStore.getState().setTree([{ ref: pRef, tag: 'p', instances: 1 }]);
    useSelectionStore.getState().setSelectedRefs([pRef]);

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: vi.fn().mockResolvedValue('<p>External snippet</p>'),
        writeText: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    const resB = await pasteClipboard();
    expect(resB).toBe(true);
    // (c) p is non-container -> sibling after
    expect(applySpy).toHaveBeenLastCalledWith({
      kind: 'insert',
      target: {
        kind: 'sibling',
        ref: { loc: pRef.loc, tag: 'p' },
        where: 'after',
      },
      jsx: '<p>External snippet</p>',
      from: undefined,
    });
  });

  it('Scenario 12: cutSelection removes multiple selected elements after copying and clears selection [R-CB-13]', async () => {
    useSelectionStore.getState().setSelectedRefs([ref1, ref2]);

    vi.spyOn(sourceClient, 'fetchElementText').mockImplementation((loc: string) => {
      if (loc === ref1.loc) {
        return Promise.resolve({ jsx: '<div/>', file: 'src/App.tsx', imports: [] });
      }
      return Promise.resolve({ jsx: '<span/>', file: 'src/App.tsx', imports: [] });
    });

    const applySpy = vi
      .spyOn(sourceClient, 'applyStructureEdit')
      .mockResolvedValue({ changed: true, files: ['src/App.tsx'], locs: [] });

    const result = await cutSelection();
    expect(result).toBe(true);

    // Entry is set
    expect(useClipboardStore.getState().entry?.text).toBe('<div/>\n<span/>');

    // remove called with both elements
    expect(applySpy).toHaveBeenCalledWith({
      kind: 'remove',
      elements: [
        { loc: ref1.loc, tag: 'div' },
        { loc: ref2.loc, tag: 'span' },
      ],
    });

    // Selection is cleared
    expect(useSelectionStore.getState().selectedRefs).toHaveLength(0);
  });

  it('pastes the Studio copy when the system clipboard could not be written, and selects every pasted element [R-CB-11]', async () => {
    const applySpy = vi.spyOn(sourceClient, 'applyStructureEdit').mockResolvedValue({
      changed: true,
      files: ['src/App.tsx'],
      locs: ['src/App.tsx:5:5', 'src/App.tsx:6:5'],
    });
    const copied = ['<p>a</p>', '<p>b</p>'].join('\n');
    useClipboardStore.getState().setEntry({
      text: copied,
      from: { file: 'src/App.tsx', imports: [] },
      inSystemClipboard: false,
    });
    useSelectionStore.getState().setSelectedRefs([ref2]);
    Object.defineProperty(navigator, 'clipboard', {
      // Older text left in the system clipboard from before the copy.
      value: { readText: vi.fn().mockResolvedValue('https://old.example'), writeText: vi.fn() },
      configurable: true,
      writable: true,
    });

    expect(await pasteClipboard()).toBe(true);
    expect(applySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ jsx: copied, from: { file: 'src/App.tsx', imports: [] } }),
    );
    expect(useSelectionStore.getState().selectedRefs).toEqual([
      { loc: 'src/App.tsx:5:5', index: 0 },
      { loc: 'src/App.tsx:6:5', index: 0 },
    ]);
  });
});
