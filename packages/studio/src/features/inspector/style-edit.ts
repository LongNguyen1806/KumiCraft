// Pure helpers constructing setStyle operations for the Inspector (SPEC-04.1 section 11.3, WP-1.09 part B).
import {
  type Breakpoint,
  type DesignNode,
  effectiveStyleValue,
  type NodeRecord,
  type OperationOf,
  type ResponsiveMode,
  type Spacing,
  type StyleScope,
} from '@reactcraft/model';

import type { PaddingEdge } from './field-descriptors.ts';

type PaddingSides = {
  readonly top?: Spacing;
  readonly right?: Spacing;
  readonly bottom?: Spacing;
  readonly left?: Spacing;
};

type NodeLike = Pick<DesignNode, 'id' | 'style' | 'responsive'> | NodeRecord;

/** Builds a setStyle operation for one padding edge while keeping effective values of other edges. */
export function buildSetPaddingEdge(
  node: NodeLike,
  edge: PaddingEdge,
  value: Spacing,
  width: number,
  mode: ResponsiveMode,
  scope: StyleScope,
  pageId: string,
): OperationOf<'setStyle'> {
  const effective = effectiveStyleValue(node, 'padding', width, mode).value as
    PaddingSides | undefined;
  const padding: Record<PaddingEdge, Spacing | undefined> = {
    top: edge === 'top' ? value : effective?.top,
    right: edge === 'right' ? value : effective?.right,
    bottom: edge === 'bottom' ? value : effective?.bottom,
    left: edge === 'left' ? value : effective?.left,
  };
  return {
    op: 'setStyle',
    target: { kind: 'page', pageId },
    nodeId: node.id,
    scope,
    set: { padding },
  };
}

/** Builds a setStyle operation for an unnested property (gap, direction, opacity). */
export function buildSetStyleProperty(
  nodeId: string,
  property: string,
  value: unknown,
  scope: StyleScope,
  pageId: string,
): OperationOf<'setStyle'> {
  return {
    op: 'setStyle',
    target: { kind: 'page', pageId },
    nodeId,
    scope,
    set: { [property]: value },
  };
}

/** Builds a setStyle operation clearing an override property at a given breakpoint. */
export function buildClearOverride(
  nodeId: string,
  property: string,
  breakpoint: Breakpoint,
  pageId: string,
): OperationOf<'setStyle'> {
  const scope = breakpoint === 'base' ? {} : { breakpoint };
  return {
    op: 'setStyle',
    target: { kind: 'page', pageId },
    nodeId,
    scope,
    set: {},
    unset: [property],
  };
}
