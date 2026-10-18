import type { ElementRef, TreeNode } from '@reactcraft/shared';

import { applyStructureEdit, fetchElementText } from '../../api/source-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { determineInsertTarget } from '../library/insert-block.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag, runStructureOp } from '../structure/structure-commands.ts';
import { useStructureErrorStore } from '../structure/structure-error-store.ts';
import { type ClipboardEntry, useClipboardStore } from './clipboard-store.ts';

const MAX_CLIPBOARD_BYTES = 1024 * 1024; // 1 MB (S-17)

export function sortRefsInDocumentOrder(
  refs: readonly ElementRef[],
  treeNodes: readonly TreeNode[],
): readonly ElementRef[] {
  const indexMap = new Map<string, number>();
  treeNodes.forEach((node, idx) => {
    const key = `${node.ref.loc}#${String(node.ref.index)}`;
    if (!indexMap.has(key)) {
      indexMap.set(key, idx);
    }
  });

  return [...refs].sort((a, b) => {
    const keyA = `${a.loc}#${String(a.index)}`;
    const keyB = `${b.loc}#${String(b.index)}`;
    const idxA = indexMap.get(keyA);
    const idxB = indexMap.get(keyB);
    if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;
    return 0;
  });
}

function resolveFromMetadata(
  results: readonly { file: string; imports: readonly string[] }[],
): ClipboardEntry['from'] {
  if (results.length === 0) return undefined;
  const firstFile = results[0]?.file;
  if (!firstFile) return undefined;

  const sameFile = results.every((r) => r.file === firstFile);
  if (!sameFile) return undefined;

  const allImports = results.flatMap((r) => r.imports);
  const uniqueImports = Array.from(new Set(allImports));
  return {
    file: firstFile,
    imports: uniqueImports,
  };
}

export async function copySelection(): Promise<boolean> {
  const { selectedRefs, treeNodes } = useSelectionStore.getState();
  if (selectedRefs.length === 0) return false;

  const ordered = sortRefsInDocumentOrder(selectedRefs, treeNodes);
  useStructureErrorStore.getState().clearError();

  const results: { file: string; imports: readonly string[]; jsx: string }[] = [];
  for (const ref of ordered) {
    try {
      const text = await fetchElementText(ref.loc);
      results.push(text);
    } catch (err) {
      const targetKey = `${ref.loc}#${String(ref.index)}`;
      useStructureErrorStore.getState().setError({ targetKey, info: toErrorInfo(err) });
      return false;
    }
  }

  const combinedJsx = results.map((r) => r.jsx).join('\n');
  const from = resolveFromMetadata(results);

  let inSystemClipboard = true;
  try {
    await navigator.clipboard.writeText(combinedJsx);
  } catch {
    // The browser denies the write while the focus is in the Canvas iframe (spec-log #22).
    inSystemClipboard = false;
  }
  useClipboardStore.getState().setEntry({ text: combinedJsx, from, inSystemClipboard });

  return true;
}

export async function cutSelection(): Promise<boolean> {
  const { selectedRefs } = useSelectionStore.getState();
  if (selectedRefs.length === 0) return false;

  const copied = await copySelection();
  if (!copied) return false;

  const primaryRef = selectedRefs[selectedRefs.length - 1];
  if (!primaryRef) return false;
  const tag = resolveTargetTag(primaryRef) ?? 'div';

  const elements = selectedRefs.map((r) => ({
    loc: r.loc,
    tag: resolveTargetTag(r) ?? 'div',
  }));

  return runStructureOp(
    { ref: primaryRef, tag },
    () => applyStructureEdit({ kind: 'remove', elements }),
    () => {
      useSelectionStore.getState().clearSelection();
    },
  );
}

async function readClipboardText(): Promise<string | undefined> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    // Ignore clipboard read error (iframe focus or unsupported)
  }
  return undefined;
}

function resolvePastePayload(
  sysText: string | undefined,
  entry: ClipboardEntry | undefined,
): { text?: string | undefined; from?: ClipboardEntry['from'] | undefined } {
  const entryWins = entry !== undefined && entry.inSystemClipboard === false;
  if (
    !entryWins &&
    sysText !== undefined &&
    sysText !== '' &&
    (entry === undefined || sysText !== entry.text)
  ) {
    return { text: sysText, from: undefined };
  }
  if (entry !== undefined && entry.text !== '') {
    return { text: entry.text, from: entry.from };
  }
  return {};
}

export async function pasteClipboard(): Promise<boolean> {
  const { selectedRefs } = useSelectionStore.getState();
  if (selectedRefs.length === 0) return false;

  const primaryRef = selectedRefs[selectedRefs.length - 1];
  if (!primaryRef) return false;
  const tag = resolveTargetTag(primaryRef) ?? 'div';
  const target = determineInsertTarget(primaryRef, tag);

  const sysText = await readClipboardText();
  const entry = useClipboardStore.getState().entry;
  const { text, from } = resolvePastePayload(sysText, entry);

  if (!text || text.trim() === '') return false;

  if (new TextEncoder().encode(text).length > MAX_CLIPBOARD_BYTES) {
    const targetKey = `${primaryRef.loc}#${String(primaryRef.index)}`;
    useStructureErrorStore.getState().setError({
      targetKey,
      info: { code: 'E016', params: { reason: 'tooLarge' } },
    });
    return false;
  }

  return runStructureOp(
    { ref: primaryRef, tag },
    () => applyStructureEdit({ kind: 'insert', target, jsx: text, from }),
    (res) => {
      // Every pasted element has a loc of its own, so each is the first instance of it.
      const newRefs = res.locs.map((loc) => ({ loc, index: 0 }));
      if (newRefs.length > 0) {
        useSelectionStore.getState().setSelectedRefs(newRefs);
      }
    },
  );
}
