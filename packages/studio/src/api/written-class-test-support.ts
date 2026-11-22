// What the server writes for a class edit, for tests: the steps of a `setClasses` edit applied with
// the Studio's class context (the server runs the same functions, 03 section 3.3).
import type { BatchEdit, SetClassesEdit, SourceEdit } from '@kumicraft/shared';
import { applyClassSteps } from '@kumicraft/style-tailwind';

import { currentClassContext } from '../features/inspector/screen-scope.ts';

export function writtenClass(
  edit: BatchEdit | SourceEdit | SetClassesEdit | undefined,
): string | undefined {
  if (edit === undefined) return undefined;
  if (edit.kind === 'setClassName') return edit.after;
  if (edit.kind !== 'setClasses') return undefined;
  const out = applyClassSteps(edit.before, edit.steps, currentClassContext());
  return out.ok ? out.value : undefined;
}

/** The edit as the server writes it: a `setClasses` edit becomes the `setClassName` it resolves to. */
export function asWritten<E extends BatchEdit | SourceEdit | SetClassesEdit>(
  edit: E,
): E | SourceEdit {
  if (edit.kind !== 'setClasses') return edit;
  return {
    kind: 'setClassName',
    loc: edit.loc,
    tag: edit.tag,
    before: edit.before,
    after: writtenClass(edit) ?? edit.before,
  };
}
