// Pure target picking function (SPEC-04.1 sections 8.2, 8.3, ADR-FE-10).
export type PickTargetOptions = {
  readonly chain: readonly string[];
  readonly selected: readonly string[];
  readonly modifiers: {
    readonly shift?: boolean;
    readonly deep?: boolean;
  };
  readonly isLocked?: (id: string) => boolean;
};

export type PickTargetResult = {
  readonly kind: 'select' | 'toggle' | 'clear';
  readonly id?: string | undefined;
};

/**
 * Picks the target node on Canvas click based on ancestral chain, current selection,
 * keyboard modifiers (Shift for multi-select, Ctrl/Cmd for deep select), and locked status.
 */
export function pickTarget(options: PickTargetOptions): PickTargetResult {
  const isLocked = options.isLocked ?? (() => false);
  const validChain = options.chain.filter((id) => !isLocked(id));
  if (validChain.length === 0) {
    return { kind: 'clear' };
  }

  const shift = options.modifiers.shift ?? false;
  const deep = options.modifiers.deep ?? false;

  if (deep) {
    const deepest = validChain.at(-1);
    return shift ? { kind: 'toggle', id: deepest } : { kind: 'select', id: deepest };
  }

  if (shift) {
    const alreadySelected = validChain.filter((id) => options.selected.includes(id)).at(-1);
    if (alreadySelected !== undefined) {
      return { kind: 'toggle', id: alreadySelected };
    }
    return { kind: 'toggle', id: validChain[0] };
  }

  const currentPrimary = options.selected.at(-1);
  let targetId: string;

  if (currentPrimary !== undefined && validChain.includes(currentPrimary)) {
    const currentIndex = validChain.indexOf(currentPrimary);
    if (currentIndex < validChain.length - 1) {
      targetId = validChain[currentIndex + 1] ?? currentPrimary; // [R-OV-02]
    } else {
      targetId = currentPrimary;
    }
  } else {
    targetId = validChain[0] ?? ''; // [R-OV-01]
  }

  return { kind: 'select', id: targetId };
}
