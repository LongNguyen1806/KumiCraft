// Writes one style change of the Inspector to the project's CSS (SPEC-04 M-ST, R-ST-06 to R-ST-09,
// R-ST-15). The browser's probe says which rule wins; the change goes to that rule ("all N
// elements", the default of R-ST-07) or to a class made for the element ("only this one").
import { posix } from 'node:path';

import {
  CSS_LONGHAND_OF,
  err,
  type MatchedRule,
  ok,
  type Result,
  type StyleApplyRequest,
  type StylingReport,
} from '@kumicraft/shared';
import { customAlphabet } from 'nanoid';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { parseJsxAst } from '../source-editor/ast-helpers.ts';
import { computeSha256 } from '../source-editor/source-editor-lookup.ts';
import type { SourceEditorService, WrittenFile } from '../source-editor/source-editor-service.ts';
import { findImportInsertPosition } from '../source-editor/structure/imports.ts';
import {
  hasStateInSelector,
  setRuleDeclaration,
  upsertRuleDeclaration,
  withStateSelector,
} from './css-edit.ts';
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
};

export type StyleApplied = {
  readonly files: readonly WrittenFile[];
  readonly className?: string | undefined;
};

type ProjectRule = { readonly rule: MatchedRule; readonly file: string };

function projectRule(root: string, rule: MatchedRule | undefined): ProjectRule | undefined {
  if (rule?.sheet.kind !== 'module' || /\.module\.\w+$/.test(rule.sheet.id.split('?')[0] ?? '')) {
    return undefined;
  }
  const file = projectFileOf(root, rule.sheet.id);
  return file === undefined ? undefined : { rule, file };
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
  const { value, media, state } = change;
  // A rule already under a @media that applies to this frame is the one to change; only a rule of
  // every frame gets the frame's own @media (R-ST-09).
  const inPlaceMedia = media === undefined || target.rule.media.length > 0;
  const inPlaceState = state === undefined || hasStateInSelector(target.rule.selector, state);
  const inPlace = inPlaceMedia && inPlaceState;
  const effectiveMedia = target.rule.media[0] ?? media;
  const targetSelector =
    state === undefined ? target.rule.selector : withStateSelector(target.rule.selector, state);
  const next = inPlace
    ? setRuleDeclaration(css.value, target.rule, longhand, value)
    : upsertRuleDeclaration(css.value, targetSelector, longhand, value, effectiveMedia);
  if (!next.ok) return next;
  if (next.value === css.value) return ok({ files: [] });
  const written = await writeFile(deps.fs, root, target.file, css.value, next.value);
  return written.ok ? ok({ files: [written.value] }) : written;
}

/** The plain `.css` file the element's own file imports, if any. */
function importedCss(code: string, jsxFile: string): string | undefined {
  const match = /import\s+['"](\.{1,2}\/[^'"]+(?<!\.module)\.css)['"]/.exec(code);
  return match?.[1] === undefined
    ? undefined
    : posix.normalize(posix.join(posix.dirname(jsxFile), match[1]));
}

function addCssImport(code: string, cssName: string): string {
  const eol = code.includes('\r\n') ? '\r\n' : '\n';
  const at = findImportInsertPosition(parseJsxAst(code), code);
  return `${code.slice(0, at)}import './${cssName}';${eol}${code.slice(at)}`;
}

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
  if (cls.kind !== 'static' && cls.kind !== 'none') {
    return err({ code: 'E016', params: { reason: 'expression' } });
  }
  const className = cls.kind === 'static' ? cls.value : undefined;
  return ok({
    jsxFile: loc.split(':')[0] ?? loc,
    tag: element.value.tag,
    classes: (className ?? '').split(/\s+/).filter((c) => c !== ''),
    className,
  });
}

/**
 * Where the element's new rule goes: the winning rule's file, the CSS its file imports, or a new
 * `<File>.css` beside it that the file then imports (the import is recorded in `writes`).
 */
async function cssFileFor(
  deps: StyleApplyDeps,
  root: string,
  jsxFile: string,
  winner: ProjectRule | undefined,
  writes: WrittenFile[],
): Promise<Result<string>> {
  if (winner !== undefined) return ok(winner.file);
  const jsx = await readFile(deps.fs, root, jsxFile);
  if (!jsx.ok) return jsx;
  const imported = importedCss(jsx.value, jsxFile);
  if (imported !== undefined) return ok(imported);
  const name = `${posix.basename(jsxFile).replace(/\.[jt]sx?$/, '')}.css`;
  const added = await writeFile(deps.fs, root, jsxFile, jsx.value, addCssImport(jsx.value, name));
  if (!added.ok) return added;
  writes.push(added.value);
  return ok(posix.join(posix.dirname(jsxFile), name));
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
  state: StyleApplyRequest['change']['state'],
): string {
  const winnerSel =
    winner !== undefined && !winner.rule.selector.includes(',')
      ? winner.rule.selector.replace(/(?::[\w-]+)+$/, '')
      : '';
  const base = `${winnerSel}.${newClass}`;
  return state === undefined ? base : withStateSelector(base, state);
}

/** "Only this element": a class of its own, kept for the next change (R-ST-06). */
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
  const ownRule =
    own === undefined
      ? undefined
      : probe.rules.find((r) => new RegExp(`\\.${own}(?::[\\w-]+)*$`).test(r.selector));
  const ownTarget = projectRule(root, ownRule);
  if (ownTarget !== undefined) return applyToRule(deps, root, ownTarget, longhand, change);
  if (change.value === undefined) return ok({ files: [] });

  const newClass = own ?? newClassName(ctx.value, deps.newId);
  const selector = elementSelector(winner, newClass, change.state);

  const writes: WrittenFile[] = [];
  if (own === undefined) {
    const nextClasses = [...ctx.value.classes, newClass];
    const classEdit = await addClass(deps, root, request, ctx.value, nextClasses, writes);
    if (!classEdit.ok) return classEdit;
  }

  const cssFile = await cssFileFor(deps, root, ctx.value.jsxFile, winner, writes);
  if (!cssFile.ok) return cssFile;
  const css = await readFile(deps.fs, root, cssFile.value);
  const cssBefore = css.ok ? css.value : undefined;
  const next = upsertRuleDeclaration(
    cssBefore ?? '',
    selector,
    longhand,
    change.value,
    change.media,
  );
  if (!next.ok) return next;
  const written = await writeFile(deps.fs, root, cssFile.value, cssBefore, next.value);
  if (!written.ok) return written;
  writes.push(written.value);
  return ok({ files: mergeWrites(writes), className: newClass });
}

/** R-ST-06: one Inspector change; the caller makes the written files one history entry (R-ST-15). */
export async function applyStyleChange(
  deps: StyleApplyDeps,
  root: string,
  request: StyleApplyRequest,
): Promise<Result<StyleApplied>> {
  const longhand = CSS_LONGHAND_OF[request.change.property];
  if (longhand === undefined) return err({ code: 'E016', params: { reason: 'unknownProperty' } });
  const winner = winnerFor(request.probe, longhand);
  const winnerRule = winner.kind === 'rule' ? winner.rule : undefined;
  if (await isModulesApplicable(deps, root, request, winnerRule)) {
    return applyModulesChange(deps, root, request, longhand, winnerRule);
  }
  const target = winner.kind === 'rule' ? projectRule(root, winner.rule) : undefined;
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
  return applyToElement(deps, root, request, longhand, target);
}
