// Structure action custom hook (SPEC-04 R-SE-24..28).
import type { StructureResult } from '@reactcraft/shared';
import { useState } from 'react';

import { applyStructureEdit } from '../../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../../routes/error-text.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import { siblingMoveTarget } from '../sibling-move.ts';
import type { InspectorTarget } from '../types.ts';

type ActionErrorState = {
  readonly targetKey: string;
  readonly info: ErrorInfo;
};

type ActionContext = {
  readonly loc: string;
  readonly tag: string;
  readonly targetKey: string;
};

async function executeAction(
  ctx: ActionContext,
  fn: () => Promise<StructureResult>,
  onSuccess: (res: StructureResult) => void,
  setPending: (v: boolean) => void,
  setErrorState: (v?: ActionErrorState) => void,
  setWarnings: (w: readonly string[]) => void,
) {
  setPending(true);
  setErrorState(undefined);
  setWarnings([]);
  try {
    const res = await fn();
    onSuccess(res);
    if (res.warnings) setWarnings(res.warnings);
  } catch (err) {
    setErrorState({ targetKey: ctx.targetKey, info: toErrorInfo(err) });
  } finally {
    setPending(false);
  }
}

type BasicRunnersProps = {
  readonly ctx?: ActionContext | undefined;
  readonly setPending: (v: boolean) => void;
  readonly setErrorState: (v?: ActionErrorState) => void;
  readonly setWarnings: (w: readonly string[]) => void;
  readonly onSelect: (res: StructureResult) => void;
  readonly clearSelection: () => void;
};

function createBasicRunners({
  ctx,
  setPending,
  setErrorState,
  setWarnings,
  onSelect,
  clearSelection,
}: BasicRunnersProps) {
  const runDuplicate = async () => {
    if (!ctx) return;
    await executeAction(
      ctx,
      () => applyStructureEdit({ kind: 'duplicate', elements: [{ loc: ctx.loc, tag: ctx.tag }] }),
      onSelect,
      setPending,
      setErrorState,
      setWarnings,
    );
  };

  const runRemove = async () => {
    if (!ctx) return;
    await executeAction(
      ctx,
      () => applyStructureEdit({ kind: 'remove', elements: [{ loc: ctx.loc, tag: ctx.tag }] }),
      clearSelection,
      setPending,
      setErrorState,
      setWarnings,
    );
  };

  const runUnwrap = async () => {
    if (!ctx) return;
    await executeAction(
      ctx,
      () => applyStructureEdit({ kind: 'unwrap', element: { loc: ctx.loc, tag: ctx.tag } }),
      clearSelection,
      setPending,
      setErrorState,
      setWarnings,
    );
  };

  return { runDuplicate, runRemove, runUnwrap };
}

type MoveWrapRunnersProps = {
  readonly ctx?: ActionContext | undefined;
  readonly moveUpTarget?: ReturnType<typeof siblingMoveTarget> | undefined;
  readonly moveDownTarget?: ReturnType<typeof siblingMoveTarget> | undefined;
  readonly setPending: (v: boolean) => void;
  readonly setErrorState: (v?: ActionErrorState) => void;
  readonly setWarnings: (w: readonly string[]) => void;
  readonly onSelect: (res: StructureResult) => void;
};

function createMoveWrapRunners({
  ctx,
  moveUpTarget,
  moveDownTarget,
  setPending,
  setErrorState,
  setWarnings,
  onSelect,
}: MoveWrapRunnersProps) {
  const runMove = async (direction: 'up' | 'down') => {
    if (!ctx) return;
    const target = direction === 'up' ? moveUpTarget : moveDownTarget;
    if (!target) return;
    await executeAction(
      ctx,
      () =>
        applyStructureEdit({
          kind: 'move',
          elements: [{ loc: ctx.loc, tag: ctx.tag }],
          target,
        }),
      onSelect,
      setPending,
      setErrorState,
      setWarnings,
    );
  };

  const runWrap = async (wrapper: 'row' | 'column' | 'grid') => {
    if (!ctx) return;
    await executeAction(
      ctx,
      () =>
        applyStructureEdit({
          kind: 'wrap',
          elements: [{ loc: ctx.loc, tag: ctx.tag }],
          wrapper,
        }),
      onSelect,
      setPending,
      setErrorState,
      setWarnings,
    );
  };

  return { runMove, runWrap };
}

export function useStructureActions(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
) {
  const setSelectedRefs = useSelectionStore((s) => s.setSelectedRefs);
  const clearSelection = useSelectionStore((s) => s.clearSelection);
  const treeNodes = useSelectionStore((s) => s.treeNodes);

  const [pending, setPending] = useState(false);
  const [errorState, setErrorState] = useState<ActionErrorState>();
  const [warnings, setWarnings] = useState<readonly string[]>([]);

  const tag = target.source?.tag;
  const targetKey = `${target.ref.loc}#${String(target.ref.index)}`;
  const loc = target.ref.loc;
  const ctx: ActionContext | undefined = tag ? { loc, tag, targetKey } : undefined;

  const moveUpTarget = siblingMoveTarget(treeNodes, target.ref, 'up');
  const moveDownTarget = siblingMoveTarget(treeNodes, target.ref, 'down');

  const onSelect = (res: StructureResult) => {
    const newLoc = res.locs[0];
    if (newLoc) setSelectedRefs([{ loc: newLoc, index: 0 }]);
  };

  const basicRunners = createBasicRunners({
    ctx,
    setPending,
    setErrorState,
    setWarnings,
    onSelect,
    clearSelection,
  });

  const moveWrapRunners = createMoveWrapRunners({
    ctx,
    moveUpTarget,
    moveDownTarget,
    setPending,
    setErrorState,
    setWarnings,
    onSelect,
  });

  const errorInfo = errorState?.targetKey === targetKey ? errorState.info : undefined;

  return {
    pending,
    errorInfo,
    warnings,
    moveUpTarget,
    moveDownTarget,
    ...basicRunners,
    ...moveWrapRunners,
  };
}
