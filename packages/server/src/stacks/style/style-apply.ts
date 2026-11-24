// Writes one style change of the Inspector to the project's CSS (SPEC-04 M-ST, R-ST-06 to R-ST-09,
// R-ST-15). The browser's probe says which rule wins; the change goes to that rule ("all N
// elements", the default of R-ST-07) or to a class made for the element ("only this one").
import {
  CSS_LONGHAND_OF,
  err,
  type MatchedRule,
  ok,
  projectBreakpoints,
  type Result,
  type StyleApplyRequest,
} from '@kumicraft/shared';
import { customAlphabet } from 'nanoid';

import type { WrittenFile } from '../../kernel/editing.ts';
import { commitFileChanges } from '../../kernel/file-writer.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { ensureKeyframesBlock, resolveMergedCssValue } from './css-composite-apply.ts';
import {
  hasModifiersInSelector,
  type SelectorModifiers,
  setDeclarationAtAnchor,
  setRuleDeclaration,
  upsertRuleDeclaration,
  withModifiersSelector,
} from './css-edit.ts';
import { findRuleSource } from './css-locate.ts';
import { locateBySourceMap } from './mapped-source.ts';
import { projectFileOfSheet } from './project-file.ts';
import { tryApplyBootstrapChange } from './style-apply-bootstrap.ts';
import { applyModulesChange, isModulesApplicable } from './style-apply-modules.ts';
import { primarySystem, winnerFor } from './style-service.ts';

/** Classes made by KumiCraft for one element end in `-` and four letters or digits. */
const OWN_CLASS = /^[A-Za-z][\w-]*-[a-z0-9]{4}$/;

type ProjectRule = {
  readonly rule: MatchedRule;
  readonly file: string;
  /** Where the source map puts the rule's declaration in `file`; absent without a map. */
  readonly anchor?: { readonly line: number; readonly column: number } | undefined;
};

function projectRule(
  root: string,
  rule: MatchedRule | undefined,
  globalCss?: readonly string[],
): ProjectRule | undefined {
  if (rule === undefined) return undefined;
  if (rule.sheet.kind === 'module' && /\.module\.\w+$/.test(rule.sheet.id.split('?')[0] ?? '')) {
    return undefined;
  }
  const file = projectFileOfSheet(root, rule.sheet, globalCss);
  return file === undefined ? undefined : { rule, file };
}

/**
 * The project file and place of the winning rule: through the dev server's source map when there
 * is one (exact, partials and nesting included), else by selector. `generated` when the rule comes
 * from a mixin, function or loop, which one edit cannot change for this rule alone.
 */
async function resolveProjectRule(
  deps: StyleApplyDeps,
  root: string,
  rule: MatchedRule | undefined,
  longhand: string,
): Promise<ProjectRule | 'generated' | undefined> {
  const base = projectRule(root, rule, deps.styling?.globalCss);
  if (base === undefined) return undefined;
  if (base.rule.sheet.kind === 'module') {
    const mapped = await locateBySourceMap(deps, root, base.rule, longhand);
    if (mapped?.kind === 'external') return undefined;
    if (mapped?.kind === 'project') {
      return mapped.editable
        ? { rule: base.rule, file: mapped.file, anchor: mapped.anchor }
        : 'generated';
    }
  }
  if (/\.(scss|sass|less)$/.test(base.file)) {
    const src = await findRuleSource(deps.fs, root, base.file, base.rule);
    if (src !== undefined) return { rule: base.rule, file: src.file };
  }
  return base;
}

/** "All N elements": the winning rule, or the same selector inside the frame's `@media` or `:state`. */
async function applyToRule(
  deps: StyleApplyDeps,
  root: string,
  target: ProjectRule,
  longhand: string,
  change: StyleApplyRequest['change'],
): Promise<Result<StyleApplied>> {
  const css = await readFile(deps.fs, root, target.file);
  if (!css.ok) return css;
  const { value, media, state, dark, groupSelector } = change;
  const mods: SelectorModifiers = { state, dark, groupSelector };
  const inPlace =
    (media === undefined || target.rule.media.length > 0) &&
    hasModifiersInSelector(target.rule.selector, mods);
  const effectiveMedia = target.rule.media[0] ?? media;
  const targetSelector = withModifiersSelector(target.rule.selector, mods);
  const resolvedVal = resolveMergedCssValue(css.value, {
    propertyId: change.property,
    longhand,
    value,
    selector: inPlace ? target.rule.selector : targetSelector,
    media: effectiveMedia,
    ruleKey: inPlace ? target.rule : undefined,
    file: target.file,
  });
  const next = inPlace
    ? target.anchor === undefined
      ? setRuleDeclaration(css.value, target.rule, longhand, resolvedVal, target.file)
      : setDeclarationAtAnchor(css.value, target.anchor, longhand, resolvedVal, target.file)
    : upsertRuleDeclaration(
        css.value,
        targetSelector,
        longhand,
        resolvedVal,
        effectiveMedia,
        target.file,
      );
  if (!next.ok) return next;
  const finalCss = ensureKeyframesBlock(next.value, change.property, resolvedVal);
  if (finalCss === css.value) return ok({ files: [] });
  const written = await writeFile(deps.fs, root, target.file, css.value, finalCss);
  return written.ok ? ok({ files: [written.value] }) : written;
}

import type { StyleApplied, StyleApplyDeps } from '../../kernel/features.ts';
import {
  addClass,
  type ElementContext,
  elementContext,
  mergeWrites,
  readFile,
  writeFile,
  writeFiles,
} from './style-apply-common.ts';
import {
  addCssImport,
  addPlannedImport,
  type CssFilePlan,
  importedCss,
  planCssFile,
} from './style-css-plan.ts';

export { addCssImport, addPlannedImport, type CssFilePlan, importedCss, planCssFile };

function newClassName(ctx: ElementContext, newId: (() => string) | undefined): string {
  const base = (ctx.classes[0] ?? ctx.tag).replace(/[^\w-]/g, '');
  return `${base}-${(newId ?? customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4))()}`;
}

function elementSelector(
  winner: ProjectRule | undefined,
  newClass: string,
  mods: SelectorModifiers,
): string {
  const rawWinner =
    winner !== undefined && !winner.rule.selector.includes(',')
      ? winner.rule.selector
          .replace(/^(?:\.dark|:global\(\.dark\))\s+/, '')
          .replace(/^[^\s]+:hover\s+/, '')
          .replace(/(?:\[data-selected=["']?true["']?\]|:[\w-]+)+$/, '')
      : '';
  const base = `${rawWinner}.${newClass}`;
  return withModifiersSelector(base, mods);
}

async function buildNewElementCss(
  deps: StyleApplyDeps,
  root: string,
  jsxFile: string,
  selector: string,
  change: StyleApplyRequest['change'],
  winner: ProjectRule | undefined,
): Promise<
  Result<{
    readonly file: string;
    readonly before: string | undefined;
    readonly after: string;
    readonly plan: Extract<Awaited<ReturnType<typeof planCssFile>>, { readonly ok: true }>['value'];
  }>
> {
  const plan = await planCssFile(
    deps,
    root,
    jsxFile,
    winner,
    deps.newCssDir,
    deps.styling?.globalCss,
  );
  if (!plan.ok) return plan;
  const css = await readFile(deps.fs, root, plan.value.file);
  const before = css.ok ? css.value : undefined;
  const resolvedVal = resolveMergedCssValue(before ?? '', {
    propertyId: change.property,
    longhand: change.property,
    value: change.value ?? '',
    selector,
    media: change.media,
    file: plan.value.file,
  });
  const next = upsertRuleDeclaration(
    before ?? '',
    selector,
    change.property,
    resolvedVal,
    change.media,
    plan.value.file,
  );
  if (!next.ok) return next;
  return ok({
    file: plan.value.file,
    before,
    after: ensureKeyframesBlock(next.value, change.property, resolvedVal),
    plan: plan.value,
  });
}

/** "Only this element": a class of its own, kept for the next change (R-ST-06). */
/** The rule of the element's own class, in any state (`:hover`…) or as the chosen item. */
function ownRuleOf(
  rules: StyleApplyRequest['probe']['rules'],
  own: string | undefined,
): StyleApplyRequest['probe']['rules'][number] | undefined {
  if (own === undefined) return undefined;
  const re = new RegExp(`\\.${own}(?:\\[data-selected=["']?true["']?\\]|:[\\w-]+)*$`);
  return rules.find((r) => re.test(r.selector));
}

async function rollbackWrites(
  fs: FileSystemPort,
  root: string,
  writes: readonly WrittenFile[],
): Promise<void> {
  if (writes.length === 0) return;
  const reverted = [...writes].reverse().map((w) => ({
    path: w.path,
    before: w.after,
    after: w.before,
  }));
  await commitFileChanges({ fs }, root, reverted);
}

async function commitElementWrites(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  ctx: ElementContext,
  own: string | undefined,
  newClass: string,
  built: {
    readonly file: string;
    readonly before: string | undefined;
    readonly after: string;
    readonly plan: CssFilePlan;
  },
): Promise<Result<StyleApplied>> {
  const writes: WrittenFile[] = [];
  try {
    if (own === undefined) {
      const classEdit = await addClass(
        deps,
        root,
        request,
        ctx,
        [...ctx.classes, newClass],
        writes,
      );
      if (!classEdit.ok) {
        await rollbackWrites(deps.fs, root, writes);
        return classEdit;
      }
    }
    const written = await writeFile(deps.fs, root, built.file, built.before, built.after);
    if (!written.ok) {
      await rollbackWrites(deps.fs, root, writes);
      return written;
    }
    writes.push(written.value);
    const imported = await addPlannedImport(deps, root, ctx.jsxFile, built.plan, writes);
    if (!imported.ok) {
      await rollbackWrites(deps.fs, root, writes);
      return imported;
    }
    return ok({ files: mergeWrites(writes), className: newClass });
  } catch (caught: unknown) {
    await rollbackWrites(deps.fs, root, writes);
    throw caught;
  }
}

async function applyToElement(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  longhand: string,
  winner: ProjectRule | undefined,
): Promise<Result<StyleApplied>> {
  const { probe, change } = request;
  const ctx = await elementContext(deps, root, probe.ref.loc);
  if (!ctx.ok) return ctx;
  const own = ctx.value.classes.find((c) => OWN_CLASS.test(c));
  const ownTarget = projectRule(root, ownRuleOf(probe.rules, own), deps.styling?.globalCss);
  if (ownTarget !== undefined) return applyToRule(deps, root, ownTarget, longhand, change);
  if (change.value === undefined) return ok({ files: [] });

  const newClass = own ?? newClassName(ctx.value, deps.newId);
  const selector = elementSelector(winner, newClass, {
    state: change.state,
    dark: change.dark,
    groupSelector: change.groupSelector,
  });

  // Every check happens before the first write, so a refused change leaves no file touched.
  const built = await buildNewElementCss(
    deps,
    root,
    ctx.value.jsxFile,
    selector,
    { ...change, property: longhand },
    winner,
  );
  if (!built.ok) return built;
  return commitElementWrites(deps, root, request, ctx.value, own, newClass, built.value);
}

/** `.card__title`: one class, no combinator, pseudo-class or list. */
const SINGLE_CLASS = /^\.-?[A-Za-z_][\w-]*$/;

/**
 * No rule sets the property yet, and the element has a class of its own: a single-class rule in a
 * project sheet that matches only this element on the page. The declaration goes into that rule,
 * so no new class lands in the JSX (K9.5, found on MarketLink's BEM classes).
 */
async function soleClassRule(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  longhand: string,
): Promise<ProjectRule | undefined> {
  const rule = request.probe.rules.find(
    (r) => r.affects === 1 && r.media.length === 0 && SINGLE_CLASS.test(r.selector.trim()),
  );
  if (rule === undefined) return undefined;
  const resolved = await resolveProjectRule(deps, root, rule, longhand);
  return resolved === 'generated' ? undefined : resolved;
}

/** R-ST-06: one Inspector change; the caller makes the written files one history entry (R-ST-15). */
export async function applyStyleChange(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
): Promise<Result<StyleApplied>> {
  if (request.change.breakpoint !== undefined && request.change.breakpoint !== 'base') {
    const validBps = projectBreakpoints(deps.theme);
    if (!validBps.some((b) => b.key === request.change.breakpoint)) {
      return err({ code: 'E016', params: { reason: 'unknownBreakpoint' } });
    }
  }
  const longhand = CSS_LONGHAND_OF[request.change.property];
  if (longhand === undefined) return err({ code: 'E016', params: { reason: 'unknownProperty' } });
  const winner = winnerFor(request.probe, longhand);
  const winnerRule = winner.kind === 'rule' ? winner.rule : undefined;
  if (await isModulesApplicable(deps, root, request, winnerRule)) {
    return applyModulesChange(deps, root, request, longhand, winnerRule);
  }
  const resolved =
    winner.kind === 'rule'
      ? await resolveProjectRule(deps, root, winner.rule, longhand)
      : undefined;
  if (resolved === 'generated' && request.change.target === 'rule') {
    return err({ code: 'E016', params: { reason: 'expression' } });
  }
  const target = resolved === 'generated' ? undefined : resolved;
  const toProjectRule = request.change.target === 'rule' && target !== undefined;
  // "All N elements" of a rule the project owns stays a CSS edit; a utility class only changes
  // this one element (R-ST-07, R-ST-10).
  if (!toProjectRule && primarySystem(deps.styling) === 'bootstrap5') {
    const boot = await tryApplyBootstrapChange(deps, root, request);
    if (boot !== undefined) return boot;
  }
  if (toProjectRule) {
    return applyToRule(deps, root, target, longhand, request.change);
  }
  if (winner.kind === 'none') {
    const sole = await soleClassRule(deps, root, request, longhand);
    if (sole !== undefined) return applyToRule(deps, root, sole, longhand, request.change);
  }
  return applyToElement(deps, root, request, longhand, target);
}

export type { StyleApplied, StyleApplyDeps };

export {
  addClass,
  type ElementContext,
  elementContext,
  mergeWrites,
  readFile,
  writeFile,
  writeFiles,
};
