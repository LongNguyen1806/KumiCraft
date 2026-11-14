// Block insertion logic (SPEC-04 R-LB-14, R-LB-15, TK-43, TK-47).
import {
  type ElementRef,
  type InsertTarget,
  isContainerTag,
  type LibraryBlock,
  lookFromTheme,
  type Placement,
  primarySystem,
  type ProjectLook,
  type RelPath,
  relPathProblem,
  renderBlock,
} from '@kumicraft/shared';

import { applyStructureEdit } from '../../api/source-client.ts';
import { type ErrorInfo, toErrorInfo } from '../../routes/error-text.ts';
import { selectionAnchor } from '../design/selection-anchor.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { useProjectStore } from '../project/project-store.ts';
import { useSelectionStore } from '../selection/selection-store.ts';
import { resolveTargetTag } from '../structure/structure-commands.ts';
import { getSelectedStyle } from './library-styles.ts';
import { getSelectedVariant } from './library-variants.ts';

let themeAttempted = false;
let attemptedProjectId: string | undefined;

export function resetThemeLookAttempt(): void {
  themeAttempted = false;
  attemptedProjectId = undefined;
}

async function currentLook(): Promise<ProjectLook> {
  const projectId = useProjectStore.getState().project?.id ?? '';
  if (attemptedProjectId !== projectId) {
    attemptedProjectId = projectId;
    themeAttempted = false;
  }
  const theme = useThemeStore.getState().theme;
  if (theme.file === undefined && !themeAttempted) {
    themeAttempted = true;
    try {
      await useThemeStore.getState().load();
    } catch {
      // Theme fetch failed; fall back to default role values.
    }
  }
  return lookFromTheme(useThemeStore.getState().theme, getSelectedStyle(projectId));
}

function sourceFileFromTarget(target: InsertTarget): RelPath {
  const loc = target.kind === 'sibling' ? target.ref.loc : target.parent.loc;
  const colon = loc.indexOf(':');
  const raw = colon > 0 ? loc.slice(0, colon) : 'src/App.tsx';
  return relPathProblem(raw) === undefined ? raw : 'src/App.tsx';
}

export function determineInsertTarget(ref: ElementRef, tag: string): InsertTarget {
  if (isContainerTag(tag)) {
    return {
      kind: 'child',
      parent: { loc: ref.loc, tag },
      where: 'end',
    };
  }
  return {
    kind: 'sibling',
    ref: { loc: ref.loc, tag },
    where: 'after',
  };
}

export type InsertBlockResult =
  | { readonly ok: true; readonly locs: readonly string[] }
  | { readonly ok: false; readonly error?: ErrorInfo | undefined; readonly skipped?: boolean };

export function localizedBlockLang(lang: string): 'vi' | 'en' {
  return lang.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

export function localizedBlockJsx(block: LibraryBlock, lang: string, variantId?: string): string {
  const project = useProjectStore.getState().project;
  const styling = project?.support.styling;
  const system = styling !== undefined ? primarySystem(styling) : 'tailwind4';
  const look = lookFromTheme(useThemeStore.getState().theme, getSelectedStyle(project?.id));
  const activeVariant = variantId ?? getSelectedVariant(block.id);
  return renderBlock(
    block,
    system,
    localizedBlockLang(lang),
    look,
    activeVariant,
    project?.support.uiKit,
  ).jsx;
}

export async function insertBlockAt(
  block: LibraryBlock,
  target: InsertTarget,
  lang: string,
  placement?: Placement,
  tailwindMajor?: 3 | 4,
  variantId?: string,
): Promise<InsertBlockResult> {
  const project = useProjectStore.getState().project;
  const styling = project?.support.styling;
  const system = styling !== undefined ? primarySystem(styling) : 'tailwind4';
  const look = await currentLook();
  const activeVariant = variantId ?? getSelectedVariant(block.id);
  const rendered = renderBlock(
    block,
    system,
    localizedBlockLang(lang),
    look,
    activeVariant,
    project?.support.uiKit,
  );
  try {
    const res = await applyStructureEdit({
      kind: 'insert',
      target,
      jsx: rendered.jsx,
      placement,
      tailwindMajor,
      ...(rendered.rules.length > 0 ? { css: { rules: rendered.rules } } : {}),
      ...(rendered.imports !== undefined && rendered.imports.length > 0
        ? { from: { file: sourceFileFromTarget(target), imports: [...rendered.imports] } }
        : {}),
      ...(rendered.kit !== undefined ? { kit: rendered.kit } : {}),
    });
    const newLoc = res.locs[0];
    if (newLoc) {
      useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
    }
    return { ok: true, locs: res.locs };
  } catch (err) {
    return { ok: false, error: toErrorInfo(err) };
  }
}

export async function insertBlock(
  block: LibraryBlock,
  lang: string,
  variantId?: string,
): Promise<InsertBlockResult> {
  const { selectedRefs, treeNodes } = useSelectionStore.getState();
  const ref =
    selectedRefs.length === 1
      ? selectedRefs[0]
      : block.category === 'screen' && selectedRefs.length === 0
        ? treeNodes[0]?.ref
        : undefined;
  if (!ref) {
    return { ok: false, skipped: true };
  }

  const resolved = selectionAnchor(ref);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const anchor = resolved.anchor;

  const tag = resolveTargetTag(anchor) ?? 'div';
  const target = determineInsertTarget(anchor, tag);
  return insertBlockAt(block, target, lang, undefined, undefined, variantId);
}
