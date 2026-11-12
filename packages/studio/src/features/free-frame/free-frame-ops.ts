// Operations for enabling and disabling free frame mode (R-FF-10, WP-2.12a).
import type { AttributeLevelEdit, BridgeFreeMeasurePayload, TreeNode } from '@kumicraft/shared';
import { applyPlacement, parseLocString, snap } from '@kumicraft/shared';

import { editSourceBatch } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { readStaticClassName } from './free-frame-commands.ts';
import {
  type CurrentElement,
  type FreeSnapshot,
  type FreeSnapshotChild,
  planFreeRestore,
} from './free-frame-snapshot.ts';

export type EnableFreeFrameParams = {
  readonly loc: string;
  readonly tag: string;
  readonly currentClassName: string;
  readonly grid: 1 | 4 | 8 | 16;
  readonly tailwindMajor: 3 | 4;
  readonly measurePayload: BridgeFreeMeasurePayload;
  /** Called once the batch is written, with what it replaced (spec-log #126). */
  readonly remember?: ((snapshot: FreeSnapshot) => void) | undefined;
};

async function sendBatch(edits: readonly AttributeLevelEdit[]): Promise<ErrorInfo | undefined> {
  try {
    await editSourceBatch({ edits: [...edits] });
    return undefined;
  } catch (e) {
    return toErrorInfo(e);
  }
}

function withoutClass(classString: string, name: string): string {
  return classString
    .split(/\s+/)
    .filter((c) => c !== '' && c !== name)
    .join(' ');
}

/** Turns the frame on in one batch (one Undo step). Returns the error to show, if any. */
export async function executeEnableFreeFrame(
  params: EnableFreeFrameParams,
): Promise<ErrorInfo | undefined> {
  const { loc, tag, currentClassName, grid, tailwindMajor, measurePayload } = params;

  const frameClasses = currentClassName.split(/\s+/).filter(Boolean);
  if (!frameClasses.includes('relative')) frameClasses.push('relative');
  if (!measurePayload.hasHeight) {
    frameClasses.push(`h-[${String(Math.round(measurePayload.height))}px]`);
  }

  const edits: AttributeLevelEdit[] = [
    { kind: 'setFlag', loc, tag, name: 'data-rc-free', on: true },
    { kind: 'setClassName', loc, tag, before: currentClassName, after: frameClasses.join(' ') },
  ];

  const remembered: FreeSnapshotChild[] = [];
  const seen = new Set<string>();
  for (const child of measurePayload.children) {
    // Loop instances share one source element: place it once, at its first instance.
    if (seen.has(child.ref.loc)) continue;
    seen.add(child.ref.loc);
    // Each child is read next to its own measurement, so a failure can never shift positions.
    const beforeRes = await readStaticClassName(child.ref.loc);
    if (!beforeRes.ok) return beforeRes.error;
    const before = beforeRes.value;
    const placement = {
      kind: 'free' as const,
      left: snap(child.left, grid),
      top: snap(child.top, grid),
    };
    const after = applyPlacement(before, placement, tailwindMajor);
    edits.push({ kind: 'setClassName', loc: child.ref.loc, tag: child.tag, before, after });
    remembered.push({ loc: child.ref.loc, before, after });
  }

  const error = await sendBatch(edits);
  if (error === undefined) {
    params.remember?.({
      loc,
      frameBefore: currentClassName,
      frameAfter: frameClasses.join(' '),
      children: remembered,
    });
  }
  return error;
}

/** The frame's children in the same file, each source element once (loop instances share one). */
function frameChildren(loc: string, treeNodes: readonly TreeNode[]): TreeNode[] {
  const file = parseLocString(loc)?.file;
  const nodeIdx = treeNodes.findIndex((n) => n.ref.loc === loc);
  if (nodeIdx < 0) return [];
  return treeNodes.filter(
    (n, i) =>
      n.parent === nodeIdx &&
      parseLocString(n.ref.loc)?.file === file &&
      treeNodes.findIndex((m) => m.ref.loc === n.ref.loc) === i,
  );
}

export type RestoreResult = {
  readonly error?: ErrorInfo | undefined;
  readonly restored: number;
  readonly kept: number;
};

/**
 * Turns the frame off with what turning it on recorded (spec-log #126): children never changed
 * since get their classes back, the moved or edited ones stay where they are. One Undo step.
 */
export async function executeRestoreFreeFrame(
  params: DisableFreeFrameParams & { readonly snapshot: FreeSnapshot },
): Promise<RestoreResult> {
  const { loc, tag, currentClassName, treeNodes, snapshot } = params;
  const children: CurrentElement[] = [];
  for (const child of frameChildren(loc, treeNodes)) {
    const res = await readStaticClassName(child.ref.loc);
    if (!res.ok) return { error: res.error, restored: 0, kept: 0 };
    children.push({ loc: child.ref.loc, tag: child.tag, className: res.value });
  }
  const plan = planFreeRestore(snapshot, { loc, tag, className: currentClassName }, children);
  const error = await sendBatch(plan.edits);
  return error === undefined
    ? { restored: plan.restored, kept: plan.kept }
    : { error, restored: 0, kept: 0 };
}

export type DisableFreeFrameParams = {
  readonly loc: string;
  readonly tag: string;
  readonly currentClassName: string;
  readonly treeNodes: readonly TreeNode[];
};

/** Turns the frame off in one batch: children go back to flow and keep w-/h-. */
export async function executeDisableFreeFrame(
  params: DisableFreeFrameParams,
): Promise<ErrorInfo | undefined> {
  const { loc, tag, currentClassName, treeNodes } = params;
  const children = frameChildren(loc, treeNodes);

  const edits: AttributeLevelEdit[] = [
    { kind: 'setFlag', loc, tag, name: 'data-rc-free', on: false },
    {
      kind: 'setClassName',
      loc,
      tag,
      before: currentClassName,
      after: withoutClass(currentClassName, 'relative'),
    },
  ];

  for (const child of children) {
    const beforeRes = await readStaticClassName(child.ref.loc);
    if (!beforeRes.ok) return beforeRes.error;
    const before = beforeRes.value;
    edits.push({
      kind: 'setClassName',
      loc: child.ref.loc,
      tag: child.tag,
      before,
      after: applyPlacement(before, { kind: 'flow' }),
    });
  }

  return sendBatch(edits);
}
