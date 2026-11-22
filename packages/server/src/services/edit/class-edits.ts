// Class edits sent as intents (03 sections 3.3 and 4, ADR-A4): the server, not the Studio, decides
// the classes an Inspector or Canvas change writes, with the same pure functions the Studio previews
// with (@kumicraft/style-tailwind). The view language's editor then writes them as `setClassName`.
import {
  err,
  ok,
  type ResponsiveMode,
  type Result,
  type SetClassesEdit,
  type SetClassNameEdit,
  type StylingReport,
  type ThemeInfo,
} from '@kumicraft/shared';
import { applyClassSteps, classContextOf } from '@kumicraft/style-tailwind';

import type { ClassEditResolver } from '../../kernel/editing.ts';

/** What the classes of the open project are read with. */
export type ClassProject = {
  readonly responsiveMode?: ResponsiveMode | undefined;
  readonly styling?: StylingReport | undefined;
};

export type ClassEditDeps = {
  readonly theme: () => Promise<Result<ThemeInfo>>;
  readonly project: () => Result<ClassProject>;
};

/** The theme a project without readable tokens has: the Studio reads classes with the same one. */
const NO_THEME: ThemeInfo = {
  colors: [],
  fontSizes: [],
  radii: [],
  fonts: [],
  shadows: [],
  breakpoints: [],
};

export function createClassEditResolver(deps: ClassEditDeps): ClassEditResolver {
  return {
    // The theme is read once for all the edits of a request, not once per element.
    async resolve(edits: readonly SetClassesEdit[]): Promise<Result<SetClassNameEdit[]>> {
      const info = deps.project();
      if (!info.ok) return info;
      const theme = await deps.theme();
      const ctx = classContextOf(
        theme.ok ? theme.value : NO_THEME,
        info.value.responsiveMode ?? 'desktop-first',
        info.value.styling,
      );
      const resolved: SetClassNameEdit[] = [];
      for (const edit of edits) {
        const out = applyClassSteps(edit.before, edit.steps, ctx);
        if (!out.ok) return err({ code: 'E023', params: { reason: out.reason } });
        resolved.push({
          kind: 'setClassName',
          loc: edit.loc,
          tag: edit.tag,
          before: edit.before,
          after: out.value,
        });
      }
      return ok(resolved);
    },
  };
}
