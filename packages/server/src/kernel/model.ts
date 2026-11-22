// The rest of the core model of docs/architecture/03-kien-truc-dich.md (sections 2, 3.2, 3.3,
// 3.5), as drafts: no code uses them yet. They become real when the edit path takes intents (Đợt S)
// and when a second view language can edit; until then (ADR-A7) they may still change.
import type { Result, StyleSystemId } from '@kumicraft/shared';

import type { CapabilityReason } from './stacks.ts';

/** Where an element is in the code: `file:line:column`, column from 1 (`data-rc-loc`). */
export type SourceLoc = {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** When one line of code renders several elements (a loop): which one. */
  readonly index?: number | undefined;
};

/** Where a component is used: its place and its name (`data-rc-use`). */
export type UseLoc = SourceLoc & { readonly component: string };

/** One concrete change of text in a file, against the content read (with its hash). */
export type TextChange = {
  readonly file: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly fileHash: string;
};

/** The class of an element, for every view language (section 3.5). */
export type ClassSlot =
  | {
      readonly kind: 'editable';
      readonly value: string;
      /** The dynamic part, kept as written; only the language's editor knows how to join it. */
      readonly kept?: unknown;
    }
  | { readonly kind: 'readonly'; readonly reason: CapabilityReason }
  | { readonly kind: 'absent' };

/** What a style tool asks: one CSS property, in a state and at a breakpoint (section 3.3). */
export type StyleIntent = {
  readonly property: string;
  /** `undefined` removes the property. */
  readonly value: string | undefined;
  readonly state?: 'hover' | 'focus' | 'active' | undefined;
  readonly breakpoint?: string | undefined;
  readonly scope: 'onlyThis' | 'allMatching';
};

/** The new classes of an element (added and removed tokens). */
export type ClassChange = {
  readonly add: readonly string[];
  readonly remove: readonly string[];
};

/** How a style system carries out an intent: classes on the element, or rules in a stylesheet. */
export type StylePlan =
  | { readonly kind: 'classes'; readonly change: ClassChange }
  | { readonly kind: 'stylesheet'; readonly changes: readonly TextChange[] };

/** Axis B's editor: every edit returns text changes; the kernel writes them (section 3.2). */
export interface ViewEditor<Doc> {
  readClass(doc: Doc, at: SourceLoc): ClassSlot;
  setClass(doc: Doc, at: SourceLoc, change: ClassChange): Result<readonly TextChange[]>;
  setText(doc: Doc, at: SourceLoc, text: string): Result<readonly TextChange[]>;
  setAttribute(
    doc: Doc,
    at: SourceLoc,
    name: string,
    value: string | undefined,
  ): Result<readonly TextChange[]>;
}

/** Axis C: one style system (section 3.3). */
export interface StyleSystem<Ctx> {
  readonly id: StyleSystemId;
  plan(ctx: Ctx, at: SourceLoc, intent: StyleIntent): Result<StylePlan>;
}
