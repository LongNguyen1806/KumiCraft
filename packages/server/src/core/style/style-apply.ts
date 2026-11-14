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
  type StylingReport,
  type ThemeInfo,
} from '@kumicraft/shared';
import { customAlphabet } from 'nanoid';

import type { CompiledCssPort } from '../ports/compiled-css-port.ts';
import type { FileSystemPort } from '../ports/file-system-port.ts';
import { computeSha256 } from '../source-editor/source-editor-lookup.ts';
import type { SourceEditorService, WrittenFile } from '../source-editor/source-editor-service.ts';
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
import { tryApplyBootstrapChange } from './style-apply-bootstrap.ts';
import { applyModulesChange, isModulesApplicable } from './style-apply-modules.ts';
import { primarySystem, projectFileOf, winnerFor } from './style-service.ts';

const MAX_CSS_BYTES = 2 * 1024 * 1024;
/** Classes made by KumiCraft for one element end in `-` and four letters or digits. */
const OWN_CLASS = /^[A-Za-z][\w-]*-[a-z0-9]{4}$/;

export type StyleApplyDeps = {
  readonly fs: FileSystemPort;
  readonly sourceEditor: Pick<SourceEditorService, 'getElement' | 'applyEdit'>;
  readonly newId?: (() => string) | undefined;
  readonly styling?: StylingReport | undefined;
  readonly compiledCss?: CompiledCssPort | undefined;
  readonly newCssDir?: string | undefined;
  readonly theme?: ThemeInfo | undefined;
};

export type StyleApplied = {
  readonly files: readonly WrittenFile[];
  readonly className?: string | undefined;
};

type ProjectRule = {
  readonly rule: MatchedRule;
  readonly file: string;
  /** Where the source map puts the rule's declaration in `file`; absent without a map. */
  readonly anchor?: { readonly line: number; readonly column: number } | undefined;
};

function projectRule(root: string, rule: MatchedRule | undefined): ProjectRule | undefined {
  if (rule?.sheet.kind !== 'module' || /\.module\.\w+$/.test(rule.sheet.id.split('?')[0] ?? '')) {
    return undefined;
  }
  const file = projectFileOf(root, rule.sheet.id);
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
  const base = projectRule(root, rule);
  if (base === undefined) return undefined;
  const mapped = await locateBySourceMap(deps, root, base.rule, longhand);
  if (mapped?.kind === 'external') return undefined;
  if (mapped?.kind === 'project') {
    return mapped.editable
      ? { rule: base.rule, file: mapped.file, anchor: mapped.anchor }
      : 'generated';
  }
  if (/\.(scss|sass|less)$/.test(base.file)) {
    const src = await findRuleSource(deps.fs, root, base.file, base.rule);
    if (src !== undefined) return { rule: base.rule, file: src.file };
  }
  return base;
}

export async function readFile(
  fs: FileSystemPort,
  root: string,
  file: string,
): Promise<Result<string>> {
  return fs.readText(root, file, { maxBytes: MAX_CSS_BYTES });
}

export async function writeFile(
  fs: FileSystemPort,
  root: string,
  file: string,
  before: string | undefined,
  after: string,
): Promise<Result<WrittenFile>> {
  const written = await fs.writeTextAtomic(root, file, after);
  if (!written.ok) return written;
  return ok({
    path: file,
    before,
    after,
    beforeHash: before === undefined ? undefined : computeSha256(before),
    afterHash: computeSha256(after),
  });
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

import {
  addCssImport,
  addPlannedImport,
  type CssFilePlan,
  importedCss,
  planCssFile,
} from './style-css-plan.ts';

export { addCssImport, addPlannedImport, type CssFilePlan, importedCss, planCssFile };

export function mergeWrites(files: readonly WrittenFile[]): WrittenFile[] {
  const byPath = new Map<string, WrittenFile>();
  for (const f of files) {
    const first = byPath.get(f.path);
    byPath.set(
      f.path,
      first === undefined ? f : { ...f, before: first.before, beforeHash: first.beforeHash },
    );
  }
  return [...byPath.values()];
}

export type ElementContext = {
  readonly jsxFile: string;
  /** The tag in the source, not the one the request claims. */
  readonly tag: string;
  readonly classes: readonly string[];
  readonly className: string | undefined;
};

export async function elementContext(
  deps: StyleApplyDeps,
  root: string,
  loc: string,
): Promise<Result<ElementContext>> {
  const element = await deps.sourceEditor.getElement(root, loc);
  if (!element.ok) return element;
  const cls = element.value.className;
  if (
    cls.kind !== 'static' &&
    cls.kind !== 'none' &&
    cls.kind !== 'callStatic' &&
    cls.kind !== 'templateStatic'
  ) {
    return err({ code: 'E016', params: { reason: 'expression' } });
  }
  const className =
    cls.kind === 'static' || cls.kind === 'callStatic' || cls.kind === 'templateStatic'
      ? cls.value
      : undefined;
  return ok({
    jsxFile: loc.split(':')[0] ?? loc,
    tag: element.value.tag,
    classes: (className ?? '').split(/\s+/).filter((c) => c !== ''),
    className,
  });
}

function newClassName(ctx: ElementContext, newId: (() => string) | undefined): string {
  const base = (ctx.classes[0] ?? ctx.tag).replace(/[^\w-]/g, '');
  return `${base}-${(newId ?? customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4))()}`;
}

/** Sets `nextClasses` as the element's static `className` (M-SE `setClassName`). */
export async function addClass(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
  ctx: ElementContext,
  nextClasses: readonly string[],
  writes: WrittenFile[],
): Promise<Result<unknown>> {
  return deps.sourceEditor.applyEdit(
    root,
    {
      kind: 'setClassName',
      loc: request.probe.ref.loc,
      tag: ctx.tag,
      before: ctx.className,
      after: nextClasses.join(' '),
    },
    (file) => {
      writes.push(file);
    },
  );
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
  const plan = await planCssFile(deps, root, jsxFile, winner, deps.newCssDir);
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
  const ownTarget = projectRule(root, ownRuleOf(probe.rules, own));
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
  const writes: WrittenFile[] = [];
  if (own === undefined) {
    const classes = [...ctx.value.classes, newClass];
    const classEdit = await addClass(deps, root, request, ctx.value, classes, writes);
    if (!classEdit.ok) return classEdit;
  }
  const { file, before, after } = built.value;
  const written = await writeFile(deps.fs, root, file, before, after);
  if (!written.ok) return written;
  writes.push(written.value);
  const imported = await addPlannedImport(deps, root, ctx.value.jsxFile, built.value.plan, writes);
  if (!imported.ok) return imported;
  return ok({ files: mergeWrites(writes), className: newClass });
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
