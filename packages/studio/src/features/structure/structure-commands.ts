// Shared structure commands for Inspector and keyboard shortcuts (SPEC-04 R-SE-24..28, R-KB-12).
import type { ElementRef, StructureResult, TreeNode } from '@reactcraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { siblingMoveTarget } from '../inspector/sibling-move.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { useStructureErrorStore } from './structure-error-store.ts';

function findTreeNodeByLoc(nodes: readonly TreeNode[], loc: string): TreeNode | undefined {
  return nodes.find((n) => n.ref.loc === loc);
}

/** Resolve tag: 1st ElementSource.tag loaded, 2nd TreeNode.tag in treeNodes (Section 3.4). */
export function resolveTargetTag(ref: ElementRef): string | undefined {
  const active = useStructureErrorStore.getState().activeSource;
  if (active && active.loc === ref.loc) {
    return active.tag;
  }
  const treeNodes = useSelectionStore.getState().treeNodes;
  const node = findTreeNodeByLoc(treeNodes, ref.loc);
  return node?.tag;
}

export type StructureTargetInput = {
  readonly ref: ElementRef;
  readonly tag?: string | undefined;
};

type CommandTarget = {
  readonly ref: ElementRef;
  readonly tag: string;
};

function resolveSingleTarget(target?: StructureTargetInput): CommandTarget | undefined {
  if (target) {
    const tag = target.tag ?? resolveTargetTag(target.ref);
    return tag ? { ref: target.ref, tag } : undefined;
  }
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  if (selectedRefs.length !== 1) return undefined;
  const ref = selectedRefs[0];
  if (!ref) return undefined;
  const tag = resolveTargetTag(ref);
  return tag ? { ref, tag } : undefined;
}

async function runStructureOp(
  target: CommandTarget,
  fn: () => Promise<StructureResult>,
  onSuccess: (res: StructureResult) => void,
): Promise<boolean> {
  const targetKey = `${target.ref.loc}#${String(target.ref.index)}`;
  useStructureErrorStore.getState().clearError();
  try {
    const res = await fn();
    onSuccess(res);
    useStructureErrorStore.getState().setWarnings(res.warnings ?? []);
    return true;
  } catch (err) {
    useStructureErrorStore.getState().setError({ targetKey, info: toErrorInfo(err) });
    return false;
  }
}

export async function executeDuplicate(target?: StructureTargetInput): Promise<boolean> {
  const t = resolveSingleTarget(target);
  if (!t) return false;
  return runStructureOp(
    t,
    () => applyStructureEdit({ kind: 'duplicate', elements: [{ loc: t.ref.loc, tag: t.tag }] }),
    (res) => {
      const newLoc = res.locs[0];
      if (newLoc) useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    },
  );
}

export async function executeRemove(target?: StructureTargetInput): Promise<boolean> {
  const t = resolveSingleTarget(target);
  if (!t) return false;
  return runStructureOp(
    t,
    () => applyStructureEdit({ kind: 'remove', elements: [{ loc: t.ref.loc, tag: t.tag }] }),
    () => {
      useSelectionStore.getState().clearSelection();
    },
  );
}

export async function executeUnwrap(target?: StructureTargetInput): Promise<boolean> {
  const t = resolveSingleTarget(target);
  if (!t) return false;
  return runStructureOp(
    t,
    () => applyStructureEdit({ kind: 'unwrap', element: { loc: t.ref.loc, tag: t.tag } }),
    () => {
      useSelectionStore.getState().clearSelection();
    },
  );
}

export async function executeMove(
  direction: 'up' | 'down',
  target?: StructureTargetInput,
): Promise<boolean> {
  const t = resolveSingleTarget(target);
  if (!t) return false;
  const treeNodes = useSelectionStore.getState().treeNodes;
  const moveTarget = siblingMoveTarget(treeNodes, t.ref, direction);
  if (!moveTarget) return false;
  return runStructureOp(
    t,
    () =>
      applyStructureEdit({
        kind: 'move',
        elements: [{ loc: t.ref.loc, tag: t.tag }],
        target: moveTarget,
      }),
    (res) => {
      const newLoc = res.locs[0];
      if (newLoc) useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    },
  );
}

export async function executeWrap(
  wrapper: 'row' | 'column' | 'grid',
  target?: StructureTargetInput,
): Promise<boolean> {
  const t = resolveSingleTarget(target);
  if (!t) return false;
  return runStructureOp(
    t,
    () =>
      applyStructureEdit({
        kind: 'wrap',
        elements: [{ loc: t.ref.loc, tag: t.tag }],
        wrapper,
      }),
    (res) => {
      const newLoc = res.locs[0];
      if (newLoc) useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    },
  );
}
