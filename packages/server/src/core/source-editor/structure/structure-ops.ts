// Structural text edit builders for insert, remove and duplicate (SPEC-04 R-SE-22, R-SE-25, R-SE-26).
import { err, ok, type Placement, type Result } from '@kumicraft/shared';

import {
  asAstNode,
  type AstNode,
  detectIndentation,
  getJsxTagName,
  parseJsxAst,
} from '../ast-helpers.ts';
import { jsxChildren } from './jsx-children.ts';
import { applyPlacementToJsx } from './placement-jsx.ts';
import { checkChildInsertGuard, checkElementStructureGuard } from './structure-guard.ts';
import type { TextEdit } from './text-edits.ts';

export type ResolvedElement = {
  readonly loc: string;
  readonly node: AstNode;
  readonly opening: AstNode;
  readonly start: number;
  readonly end: number;
  readonly line: number;
};

export function lineStartOf(code: string, pos: number): number {
  const idx = code.lastIndexOf('\n', pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

function lineContentEndOf(code: string, pos: number): number {
  let i = pos;
  while (i < code.length && code[i] !== '\n' && code[i] !== '\r') {
    i++;
  }
  return i;
}

export function indentOf(code: string, pos: number): string {
  const start = lineStartOf(code, pos);
  const match = /^[ \t]*/.exec(code.slice(start));
  return match?.[0] ?? '';
}

export function fileIndentUnit(code: string, targetLine: number): string {
  const info = detectIndentation(code, targetLine);
  if (info.useTab) return '\t';
  if (info.openingIndent === '' && /(?:^|\n)\t/.test(code)) {
    return '\t';
  }
  return ' '.repeat(info.step);
}

/**
 * Validates that `jsx` parses inside `<>...</>` and contains at least one JSXElement (section 4.3).
 */
export function validateInsertedJsx(jsx: string): Result<{ readonly firstTag: string }> {
  let ast: AstNode;
  try {
    ast = parseJsxAst(`<>${jsx}</>`);
  } catch {
    return err({ code: 'E016', params: { reason: 'notJsx' } });
  }

  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  if (body.length !== 1) {
    return err({ code: 'E016', params: { reason: 'notJsx' } });
  }

  const stmt = asAstNode(body[0]);
  const expr = stmt?.type === 'ExpressionStatement' ? asAstNode(stmt['expression']) : undefined;
  if (expr?.type !== 'JSXFragment') {
    return err({ code: 'E016', params: { reason: 'notJsx' } });
  }

  const children = jsxChildren(expr);
  const firstElement = children.find((c) => c.type === 'JSXElement');
  if (!firstElement) {
    return err({ code: 'E016', params: { reason: 'notJsx' } });
  }

  const opening = asAstNode(firstElement['openingElement']);
  const firstTag = (opening ? getJsxTagName(opening) : undefined) ?? 'div';
  return ok({ firstTag });
}

export function normalizeSnippetIndent(lines: readonly string[], unit: string): string[] {
  const nonEmpty = lines.filter((l) => /\S/.test(l));
  if (nonEmpty.length === 0) return [...lines];

  const indents = nonEmpty.map((l) => (/^[ \t]*/.exec(l)?.[0] ?? '').length);
  const minCommon = Math.min(...indents);
  const stripped = lines.map((l) => (/\S/.test(l) ? l.slice(minCommon) : ''));

  const remIndents = stripped.filter((l) => /\S/.test(l)).map((l) => /^[ \t]*/.exec(l)?.[0] ?? '');
  const usesTab = remIndents.some((ind) => ind.startsWith('\t'));

  let minStep = 0;
  if (!usesTab) {
    for (const ind of remIndents) {
      if (ind.length > 0) {
        minStep = minStep === 0 ? ind.length : Math.min(minStep, ind.length);
      }
    }
  }

  return stripped.map((l) => {
    if (!/\S/.test(l)) return '';
    const rem = /^[ \t]*/.exec(l)?.[0] ?? '';
    const rest = l.slice(rem.length);
    const levels = usesTab ? rem.length : minStep > 0 ? Math.floor(rem.length / minStep) : 0;
    return `${unit.repeat(levels)}${rest}`;
  });
}

export function formatInsertedJsx(
  jsx: string,
  baseIndent: string,
  unit: string,
  nl: '\r\n' | '\n',
): string {
  const lines = jsx.split(/\r?\n/);
  while (lines.length > 0 && lines[0]?.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();

  const normalized = normalizeSnippetIndent(lines, unit);
  return normalized
    .map((line, idx) => (idx === 0 || line === '' ? line : `${baseIndent}${line}`))
    .join(nl);
}

function buildSiblingEdit(
  code: string,
  refStart: number,
  refEnd: number,
  where: 'before' | 'after',
  jsx: string,
  unit: string,
  nl: '\r\n' | '\n',
): TextEdit {
  const indent = indentOf(code, refStart);
  const formatted = formatInsertedJsx(jsx, indent, unit, nl);
  const tagOffset = Math.max(0, formatted.indexOf('<'));

  if (where === 'before') {
    return {
      start: refStart,
      end: refStart,
      text: `${formatted}${nl}${indent}`,
      mark: tagOffset,
    };
  }
  return {
    start: refEnd,
    end: refEnd,
    text: `${nl}${indent}${formatted}`,
    mark: nl.length + indent.length + tagOffset,
  };
}

function buildEmptyParentChildEdit(
  code: string,
  parent: ResolvedElement,
  jsx: string,
  unit: string,
  nl: '\r\n' | '\n',
): Result<TextEdit> {
  const parentIndent = indentOf(code, parent.start);
  const childIndent = `${parentIndent}${unit}`;
  const formatted = formatInsertedJsx(jsx, childIndent, unit, nl);
  const tagOffset = Math.max(0, formatted.indexOf('<'));
  const openingEnd = parent.opening.end;
  if (openingEnd === undefined) {
    return err({ code: 'E024', params: { line: parent.line, column: 1 } });
  }

  if (parent.opening['selfClosing'] === true) {
    const tag = getJsxTagName(parent.opening) ?? 'div';
    const slashPos = openingEnd - 2;
    const replaceStart = code[slashPos - 1] === ' ' ? slashPos - 1 : slashPos;
    const text = `>${nl}${childIndent}${formatted}${nl}${parentIndent}</${tag}>`;
    return ok({
      start: replaceStart,
      end: openingEnd,
      text,
      mark: 1 + nl.length + childIndent.length + tagOffset,
    });
  }

  const closing = asAstNode(parent.node['closingElement']);
  const closingStart = closing?.start;
  if (closingStart === undefined) {
    return err({ code: 'E024', params: { line: parent.line, column: 1 } });
  }
  return ok({
    start: openingEnd,
    end: closingStart,
    text: `${nl}${childIndent}${formatted}${nl}${parentIndent}`,
    mark: nl.length + childIndent.length + tagOffset,
  });
}

/** HTML elements that never take children (void elements), plus <textarea>, whose content is text. */
const NO_CHILDREN_TAGS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
  'textarea',
]);

export function buildInsertTextEdit(
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  targetKind: 'sibling' | 'child',
  where: 'before' | 'after' | 'start' | 'end',
  resolved: ResolvedElement,
  jsx: string,
): Result<TextEdit> {
  const unit = fileIndentUnit(code, resolved.line);

  if (targetKind === 'sibling') {
    const guard = checkElementStructureGuard(ast, resolved.node, resolved.loc);
    if (!guard.ok) return guard;
    const side = where === 'before' ? 'before' : 'after';
    return ok(buildSiblingEdit(code, resolved.start, resolved.end, side, jsx, unit, nl));
  }

  // <img>, <input>… cannot hold children: React would stop drawing the page (spec-log #116).
  const parentTag = getJsxTagName(resolved.opening);
  if (parentTag !== undefined && NO_CHILDREN_TAGS.has(parentTag)) {
    return err({ code: 'E016', params: { reason: 'noChildrenTag' } });
  }
  const guard = checkChildInsertGuard(resolved.node, resolved.loc);
  if (!guard.ok) return guard;

  const children = jsxChildren(resolved.node);
  if (children.length === 0) {
    return buildEmptyParentChildEdit(code, resolved, jsx, unit, nl);
  }

  const refChild = where === 'start' ? children[0] : children[children.length - 1];
  if (refChild?.start === undefined || refChild.end === undefined) {
    return err({ code: 'E024', params: { line: resolved.line, column: 1 } });
  }
  const side = where === 'start' ? 'before' : 'after';
  return ok(buildSiblingEdit(code, refChild.start, refChild.end, side, jsx, unit, nl));
}

export function buildRemoveTextEdits(
  ast: AstNode,
  code: string,
  elements: readonly ResolvedElement[],
): Result<readonly TextEdit[]> {
  for (const el of elements) {
    const guard = checkElementStructureGuard(ast, el.node, el.loc);
    if (!guard.ok) return guard;
  }

  // Drop inner elements when an ancestor element in the same file is also being removed.
  const topLevel = elements.filter(
    (item, idx) =>
      !elements.some(
        (other, otherIdx) =>
          otherIdx !== idx &&
          other.start <= item.start &&
          item.end <= other.end &&
          (other.start < item.start || item.end < other.end || otherIdx < idx),
      ),
  );

  const edits: TextEdit[] = [];
  for (const item of topLevel) {
    const lineStart = lineStartOf(code, item.start);
    const lineEnd = lineContentEndOf(code, item.end);
    const onlyWsBefore = /^[ \t]*$/.test(code.slice(lineStart, item.start));
    const onlyWsAfter = /^[ \t]*$/.test(code.slice(item.end, lineEnd));

    if (onlyWsBefore && onlyWsAfter) {
      const afterNewline =
        code.slice(lineEnd, lineEnd + 2) === '\r\n'
          ? lineEnd + 2
          : code[lineEnd] === '\n'
            ? lineEnd + 1
            : lineEnd;
      edits.push({ start: lineStart, end: afterNewline, text: '' });
    } else {
      edits.push({ start: item.start, end: item.end, text: '' });
    }
  }

  return ok(edits);
}

export function buildDuplicateTextEdits(
  ast: AstNode,
  code: string,
  nl: '\r\n' | '\n',
  elements: readonly ResolvedElement[],
  placement?: Placement,
  tailwindMajor?: 3 | 4,
): Result<readonly TextEdit[]> {
  const edits: TextEdit[] = [];
  for (const [index, item] of elements.entries()) {
    const guard = checkElementStructureGuard(ast, item.node, item.loc);
    if (!guard.ok) return guard;
    const indent = indentOf(code, item.start);
    const placedRes = applyPlacementToJsx(
      code.slice(item.start, item.end),
      placement,
      tailwindMajor,
      index,
    );
    if (!placedRes.ok) return placedRes;
    const slice = placedRes.value;
    edits.push({
      start: item.end,
      end: item.end,
      text: `${nl}${indent}${slice}`,
      mark: nl.length + indent.length,
    });
  }
  return ok(edits);
}
