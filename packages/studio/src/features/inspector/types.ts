// Types for Inspector (SPEC-04 section 9 M-IN).
import type { ElementRef, ElementSource, InteractionState, Scope } from '@reactcraft/shared';

export type InspectorLockReason =
  'classExpression' | 'classDuplicate' | 'outsideSource' | 'tooLarge';

export type InspectorWarning = {
  readonly kind: 'usages' | 'loop';
  readonly count: number;
  readonly name?: string | undefined;
};

export type InspectorTarget =
  | { readonly kind: 'empty' }
  | { readonly kind: 'multiple'; readonly count: number }
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
      readonly refresh: () => void;
    };
