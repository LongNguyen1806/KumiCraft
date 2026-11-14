// Types for Inspector (SPEC-04 section 9 M-IN).
import type {
  ElementRef,
  ElementSource,
  InspectorPreviewState,
  InteractionState,
  Scope,
} from '@kumicraft/shared';

export type InspectorLockReason =
  'classExpression' | 'classDuplicate' | 'outsideSource' | 'tooLarge';

export type InspectorWarning = {
  readonly kind: 'usages' | 'loop';
  readonly count: number;
  readonly name?: string | undefined;
};

export type MultiTargetItem = {
  readonly ref: ElementRef;
  readonly source?: ElementSource | undefined;
};

export type MultiTarget = {
  readonly kind: 'multi';
  readonly items: readonly MultiTargetItem[];
  readonly loading: boolean;
  readonly lock?: { readonly tag: string; readonly loc: string } | undefined;
  readonly currentScope: Scope;
  readonly writePrefix: string;
  readonly refresh: () => void;
};

export type InspectorTarget =
  | { readonly kind: 'empty' }
  | MultiTarget
  | {
      readonly kind: 'element';
      readonly ref: ElementRef;
      readonly locFile?: string | undefined;
      readonly locLine?: number | undefined;
      readonly locCol?: number | undefined;
      readonly source?: ElementSource | undefined;
      readonly loading: boolean;
      readonly error?: string | undefined;
      readonly lockReason?: InspectorLockReason | undefined;
      readonly lockCode?: string | undefined;
      readonly warnings: readonly InspectorWarning[];
      readonly currentScope: Scope;
      readonly writePrefix: string;
      readonly interactionState?: InteractionState | undefined;
      readonly setInteractionState: (state?: InteractionState) => void;
      readonly previewState?: InspectorPreviewState | undefined;
      readonly setPreviewState?: ((state?: InspectorPreviewState) => void) | undefined;
      readonly groupRef?: ElementRef | undefined;
      readonly setGroupRef?: ((ref?: ElementRef) => void) | undefined;
      readonly refresh: () => void;
    };
