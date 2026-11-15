// Shared structure commands for Inspector and keyboard shortcuts (SPEC-04 R-SE-24..28, R-KB-12).
import type { ElementRef, StructureResult, TreeNode } from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { placementTailwindMajor } from '../editor/canvas-view-store.ts';
import { freeStackPlacement } from '../free-frame/free-frame-placement.ts';
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

/** True when the loaded source of `ref` holds only text, so a block cannot go inside it. */
export function isTextLeaf(ref: ElementRef): boolean {
  const active = useStructureErrorStore.getState().activeSource;
  return active !== undefined && active.loc === ref.loc && active.textOnly === true;
}

export type StructureTargetInput = {
  readonly ref: ElementRef;
  readonly tag?: string | undefined;
};

export type CommandTarget = {
  readonly ref: ElementRef;
  readonly tag: string;
  /**
   * The JSX that the edit changes when it is not `ref` itself: the selected element is the first
   * element of a component used in the page, and the use (`<Card …>`) is what moves or goes.
   */
  readonly use?: { readonly loc: string; readonly tag: string } | undefined;
};

/** The element the source edit names: the component use when there is one. */
export function editedElement(t: CommandTarget): { readonly loc: string; readonly tag: string } {
  return t.use ?? { loc: t.ref.loc, tag: t.tag };
}

/** The use of the component `ref` is the first element of, as the Canvas reported it. */
function componentUseFor(ref: ElementRef): CommandTarget['use'] {
  return useSelectionStore
    .getState()
    .selectionInfo.find((i) => i.ref.loc === ref.loc && i.ref.index === ref.index)?.use;
}

/** A new element is selected only when it is a page element; a new use has no element of its own. */
function selectNew(t: CommandTarget, res: StructureResult): void {
  const newLoc = res.locs[0];
  if (newLoc && t.use === undefined) {
    useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
  }
}

function resolveSingleTarget(target?: StructureTargetInput): CommandTarget | undefined {
  const ref = target?.ref ?? soleSelectedRef();
  if (ref === undefined) return undefined;
  const tag = target?.tag ?? resolveTargetTag(ref);
  return tag ? { ref, tag, use: componentUseFor(ref) } : undefined;
}

function soleSelectedRef(): ElementRef | undefined {
  const selectedRefs = useSelectionStore.getState().selectedRefs;
  return selectedRefs.length === 1 ? selectedRefs[0] : undefined;
}

export async function runStructureOp(
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
  const placement = await freeStackPlacement({
    kind: 'sibling',
    ref: editedElement(t),
    where: 'after',
  });
  return runStructureOp(
    t,
    () =>
      applyStructureEdit({
        kind: 'duplicate',
        elements: [editedElement(t)],
        placement,
        tailwindMajor: placementTailwindMajor(placement),
      }),
    (res) => {
      selectNew(t, res);
    },
  );
}

export async function executeRemove(target?: StructureTargetInput): Promise<boolean> {
  const t = resolveSingleTarget(target);
  if (!t) return false;
  return runStructureOp(
    t,
    () => applyStructureEdit({ kind: 'remove', elements: [editedElement(t)] }),
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
    () => applyStructureEdit({ kind: 'unwrap', element: editedElement(t) }),
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
        elements: [editedElement(t)],
        target: moveTarget,
      }),
    (res) => {
      selectNew(t, res);
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
        elements: [editedElement(t)],
        wrapper,
      }),
    (res) => {
      selectNew(t, res);
    },
  );
}
