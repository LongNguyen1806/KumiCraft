// Structure action custom hook (SPEC-04 R-SE-24..28).
import { useState } from 'react';

import { useSelectionStore } from '../../../core/selection-store.ts';
import {
  executeDuplicate,
  executeMove,
  executeRemove,
  executeUnwrap,
  executeWrap,
} from '../../structure/structure-commands.ts';
import { useStructureErrorStore } from '../../structure/structure-error-store.ts';
import { siblingMoveTarget } from '../sibling-move.ts';
import type { InspectorTarget } from '../types.ts';

export function useStructureActions(
  target: Extract<InspectorTarget, { readonly kind: 'element' }>,
) {
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const storeError = useStructureErrorStore((s) => s.error);
  const warnings = useStructureErrorStore((s) => s.warnings);
  const [pending, setPending] = useState(false);

  const targetKey = `${target.ref.loc}#${String(target.ref.index)}`;
  const errorInfo = storeError?.targetKey === targetKey ? storeError.info : undefined;

  const moveUpTarget = siblingMoveTarget(treeNodes, target.ref, 'up');
  const moveDownTarget = siblingMoveTarget(treeNodes, target.ref, 'down');

  const cmdTarget = { ref: target.ref, tag: target.source?.tag };

  const runDuplicate = async () => {
    setPending(true);
    await executeDuplicate(cmdTarget);
    setPending(false);
  };

  const runRemove = async () => {
    setPending(true);
    await executeRemove(cmdTarget);
    setPending(false);
  };

  const runUnwrap = async () => {
    setPending(true);
    await executeUnwrap(cmdTarget);
    setPending(false);
  };

  const runMove = async (direction: 'up' | 'down') => {
    setPending(true);
    await executeMove(direction, cmdTarget);
    setPending(false);
  };

  const runWrap = async (wrapper: 'row' | 'column' | 'grid') => {
    setPending(true);
    await executeWrap(wrapper, cmdTarget);
    setPending(false);
  };

  return {
    pending,
    errorInfo,
    warnings,
    moveUpTarget,
    moveDownTarget,
    runDuplicate,
    runRemove,
    runUnwrap,
    runMove,
    runWrap,
  };
}
