// Operations for enabling and disabling free frame mode (R-FF-10, WP-2.12a).
import type { AttributeLevelEdit, BridgeFreeMeasurePayload, TreeNode } from '@reactcraft/shared';
import { applyPlacement, parseLocString, snap } from '@reactcraft/shared';

import { editSourceBatch } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { readStaticClassName } from './free-frame-commands.ts';

export type EnableFreeFrameParams = {
  readonly loc: string;
  readonly tag: string;
  readonly currentClassName: string;
  readonly grid: 1 | 4 | 8 | 16;
  readonly tailwindMajor: 3 | 4;
  readonly measurePayload: BridgeFreeMeasurePayload;
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
    edits.push({
      kind: 'setClassName',
      loc: child.ref.loc,
      tag: child.tag,
      before,
      after: applyPlacement(before, placement, tailwindMajor),
    });
  }

  return sendBatch(edits);
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
  const file = parseLocString(loc)?.file;
  const nodeIdx = treeNodes.findIndex((n) => n.ref.loc === loc);
  const children =
    nodeIdx < 0
      ? []
      : treeNodes.filter(
          (n, i) =>
            n.parent === nodeIdx &&
            parseLocString(n.ref.loc)?.file === file &&
            treeNodes.findIndex((m) => m.ref.loc === n.ref.loc) === i,
        );

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
