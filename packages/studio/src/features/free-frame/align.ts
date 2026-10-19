// Align and distribute operations for elements in a free frame (SPEC-04 section 18E, R-FF-17, WP-2.12b).
import type { AttributeLevelEdit, ElementRef } from '@reactcraft/shared';
import { applyPlacement } from '@reactcraft/shared';
import { create } from 'zustand';

import { editSourceBatch } from '../../api/source-client.ts';
import type { ErrorInfo } from '../../routes/error-text.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { freeFrameOfRef, requestFreeMeasure } from './free-context.ts';
import { readStaticClassName } from './free-frame-commands.ts';

export type FreeFrameError = ErrorInfo | 'measureTimeout';

export const useFreeFrameErrorStore = create<{
  readonly error?: FreeFrameError | undefined;
  setError: (e: FreeFrameError | undefined) => void;
}>((set) => ({
  error: undefined,
  setError: (e) => {
    set({ error: e });
  },
}));

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';

export type FreeItemBox = {
  readonly key: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

function alignSingleBox(
  box: FreeItemBox,
  mode: AlignMode,
  frame: { width: number; height: number },
): { left: number; top: number } {
  switch (mode) {
    case 'left':
      return { left: 0, top: box.top };
    case 'right':
      return { left: Math.max(0, frame.width - box.width), top: box.top };
    case 'centerX':
      return { left: Math.max(0, Math.round((frame.width - box.width) / 2)), top: box.top };
    case 'top':
      return { left: box.left, top: 0 };
    case 'bottom':
      return { left: box.left, top: Math.max(0, frame.height - box.height) };
    case 'centerY':
      return { left: box.left, top: Math.max(0, Math.round((frame.height - box.height) / 2)) };
  }
}

function computeBoxPosition(
  box: FreeItemBox,
  mode: AlignMode,
  bounds: { minL: number; maxR: number; minT: number; maxB: number; midX: number; midY: number },
) {
  switch (mode) {
    case 'left':
      return { left: bounds.minL, top: box.top };
    case 'right':
      return { left: bounds.maxR - box.width, top: box.top };
    case 'centerX':
      return { left: Math.round(bounds.midX - box.width / 2), top: box.top };
    case 'top':
      return { left: box.left, top: bounds.minT };
    case 'bottom':
      return { left: box.left, top: bounds.maxB - box.height };
    case 'centerY':
      return { left: box.left, top: Math.round(bounds.midY - box.height / 2) };
  }
}

function alignGroupBoxes(
  boxes: readonly FreeItemBox[],
  mode: AlignMode,
): Map<string, { left: number; top: number }> {
  const minL = Math.min(...boxes.map((b) => b.left));
  const maxR = Math.max(...boxes.map((b) => b.left + b.width));
  const minT = Math.min(...boxes.map((b) => b.top));
  const maxB = Math.max(...boxes.map((b) => b.top + b.height));
  const bounds = { minL, maxR, minT, maxB, midX: (minL + maxR) / 2, midY: (minT + maxB) / 2 };

  const result = new Map<string, { left: number; top: number }>();
  for (const box of boxes) {
    const pos = computeBoxPosition(box, mode, bounds);
    result.set(box.key, { left: Math.max(0, pos.left), top: Math.max(0, pos.top) });
  }
  return result;
}

/** ≥ 2 hộp: căn theo khung bao nhóm; 1 hộp: theo `frame` (0, 0, frame.width, frame.height). Trả left/top mới, làm tròn. */
export function alignBoxes(
  boxes: readonly FreeItemBox[],
  mode: AlignMode,
  frame: { width: number; height: number },
): Map<string, { left: number; top: number }> {
  if (boxes.length === 0) return new Map();
  if (boxes.length === 1 && boxes[0]) {
    const single = boxes[0];
    return new Map([[single.key, alignSingleBox(single, mode, frame)]]);
  }
  return alignGroupBoxes(boxes, mode);
}

/** ≥ 3 hộp: giữ hai hộp ngoài cùng, chia đều khoảng trống giữa các hộp theo trục. < 3 → map rỗng. */
export function distributeBoxes(
  boxes: readonly FreeItemBox[],
  axis: 'x' | 'y',
): Map<string, { left: number; top: number }> {
  if (boxes.length < 3) return new Map();
  const sorted = [...boxes].sort((a, b) => (axis === 'x' ? a.left - b.left : a.top - b.top));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return new Map();

  const totalSpan =
    axis === 'x' ? last.left + last.width - first.left : last.top + last.height - first.top;
  const sumSize = sorted.reduce((sum, b) => sum + (axis === 'x' ? b.width : b.height), 0);
  const gap = (totalSpan - sumSize) / (sorted.length - 1);

  const result = new Map<string, { left: number; top: number }>();
  let currentPos = axis === 'x' ? first.left + first.width + gap : first.top + first.height + gap;

  for (let i = 1; i < sorted.length - 1; i++) {
    const box = sorted[i];
    if (!box) continue;
    const rounded = Math.max(0, Math.round(currentPos));
    result.set(box.key, {
      left: axis === 'x' ? rounded : box.left,
      top: axis === 'y' ? rounded : box.top,
    });
    currentPos += (axis === 'x' ? box.width : box.height) + gap;
  }
  return result;
}

async function verifySameFreeFrame(
  selectedRefs: readonly ElementRef[],
): Promise<{ ref: ElementRef; tag: string } | undefined> {
  let targetFrame: { ref: ElementRef; tag: string } | undefined;
  for (const ref of selectedRefs) {
    const frame = await freeFrameOfRef(ref);
    if (!frame) return undefined;
    if (!targetFrame) {
      targetFrame = frame;
    } else if (targetFrame.ref.loc !== frame.ref.loc) {
      return undefined;
    }
  }
  return targetFrame;
}

function calculateNewPositions(
  boxes: readonly FreeItemBox[],
  mode: AlignMode | 'distributeX' | 'distributeY',
  frameDim: { width: number; height: number },
): Map<string, { left: number; top: number }> {
  if (mode === 'distributeX') return distributeBoxes(boxes, 'x');
  if (mode === 'distributeY') return distributeBoxes(boxes, 'y');
  return alignBoxes(boxes, mode, frameDim);
}

async function buildAlignEdits(
  boxes: readonly FreeItemBox[],
  newPositions: Map<string, { left: number; top: number }>,
  tailwindMajor: 3 | 4,
): Promise<{ readonly edits?: AttributeLevelEdit[]; readonly error?: ErrorInfo }> {
  const { treeNodes } = useSelectionStore.getState();
  const edits: AttributeLevelEdit[] = [];

  for (const box of boxes) {
    const newPos = newPositions.get(box.key);
    if (!newPos || (newPos.left === box.left && newPos.top === box.top)) continue;

    const loc = box.key.split('#')[0] ?? '';
    const beforeRes = await readStaticClassName(loc);
    if (!beforeRes.ok) return { error: beforeRes.error };

    const before = beforeRes.value;
    const after = applyPlacement(
      before,
      { kind: 'free', left: newPos.left, top: newPos.top },
      tailwindMajor,
    );
    if (after !== before) {
      const node = treeNodes.find((n) => n.ref.loc === loc);
      edits.push({ kind: 'setClassName', loc, tag: node?.tag ?? 'div', before, after });
    }
  }
  return { edits };
}

export async function runAlign(mode: AlignMode | 'distributeX' | 'distributeY'): Promise<boolean> {
  const { selectedRefs } = useSelectionStore.getState();
  if (selectedRefs.length === 0) return false;

  const targetFrame = await verifySameFreeFrame(selectedRefs);
  if (!targetFrame) return false;

  const measurePayload = await requestFreeMeasure(targetFrame.ref, () => {
    useFreeFrameErrorStore.getState().setError('measureTimeout');
  });
  if (!measurePayload) return false;

  const boxes: FreeItemBox[] = [];
  for (const child of measurePayload.children) {
    const matched = selectedRefs.some(
      (r) => r.loc === child.ref.loc && r.index === child.ref.index,
    );
    if (matched) {
      boxes.push({
        key: `${child.ref.loc}#${String(child.ref.index)}`,
        left: child.left,
        top: child.top,
        width: child.width,
        height: child.height,
      });
    }
  }

  const newPositions = calculateNewPositions(boxes, mode, {
    width: measurePayload.width,
    height: measurePayload.height,
  });

  const { tailwindMajor } = useCanvasViewStore.getState();
  const built = await buildAlignEdits(boxes, newPositions, tailwindMajor);
  if (built.error) {
    useFreeFrameErrorStore.getState().setError(built.error);
    return false;
  }
  if (!built.edits || built.edits.length === 0) return true;

  try {
    await editSourceBatch({ edits: built.edits });
    useFreeFrameErrorStore.getState().setError(undefined);
    return true;
  } catch (err) {
    useFreeFrameErrorStore.getState().setError(toErrorInfo(err));
    return false;
  }
}
