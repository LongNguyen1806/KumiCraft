// In-memory AST mutations for Source Editor (R-SE-05..12).
import type {
  Result,
  SetAttributeEdit,
  SetClassNameEdit,
  SetFlagEdit,
  SetTagEdit,
  SetTextEdit,
  SourceEdit,
} from '@kumicraft/shared';
import {
  err,
  HTML_SETTABLE_TAGS,
  isValidSettableAttrName,
  ok,
  VOID_HTML_TAGS,
} from '@kumicraft/shared';
import type MagicString from 'magic-string';

import { asAstNode, type AstNode, getJsxTagName, parseJsxAst } from '../../../lib/ast-helpers.ts';
import { readClassName, readEditableAttributes } from './attribute-reader.ts';
import { applySetPropMutation } from './prop-mutator.ts';
import { parseText } from './source-editor-lookup.ts';
import { mutateAttribute, mutateFlag, mutateText } from './source-mutator.ts';
import { applySetTextRunMutation } from './text-run-ops.ts';

export function applyClassNameMutation(
  edit: SetClassNameEdit,
  rawAttrs: readonly unknown[],
  opening: AstNode,
  code: string,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  const currentClass = readClassName(rawAttrs, code);
  if (currentClass.kind === 'expression')
    return err({ code: 'E023', params: { reason: 'classExpression' } });
  if (currentClass.kind === 'duplicate')
    return err({ code: 'E023', params: { reason: 'duplicateAttr' } });
  const currentVal =
    currentClass.kind === 'static' ||
    currentClass.kind === 'callStatic' ||
    currentClass.kind === 'templateStatic'
      ? currentClass.value
      : undefined;
  if (edit.before !== undefined && edit.before !== currentVal)
    return err({ code: 'E017', params: { reason: 'valueChanged' } });
  if (currentVal === edit.after) return ok({ unchanged: true });
  mutateAttribute(s, code, opening, 'className', edit.after);
  return ok({});
}

export function applyAttributeMutation(
  edit: SetAttributeEdit,
  rawAttrs: readonly unknown[],
  opening: AstNode,
  code: string,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  if (!isValidSettableAttrName(edit.name)) {
    return err({ code: 'E023', params: { reason: 'blockedAttribute', name: edit.name } });
  }
  const attrs = readEditableAttributes(rawAttrs, code);
  const currentAttr = attrs[edit.name];
  if (currentAttr?.kind === 'expression')
    return err({ code: 'E023', params: { reason: 'attrExpression' } });
  const currentVal = currentAttr?.kind === 'static' ? currentAttr.value : undefined;
  if (edit.before !== undefined && edit.before !== currentVal)
    return err({ code: 'E017', params: { reason: 'valueChanged' } });
  if (currentVal === edit.after) return ok({ unchanged: true });
  mutateAttribute(s, code, opening, edit.name, edit.after);
  return ok({});
}

export function applyTextMutation(
  edit: SetTextEdit,
  targetNode: AstNode,
  opening: AstNode,
  code: string,
  s: MagicString,
  newline: '\r\n' | '\n',
): Result<{ unchanged?: boolean }> {
  if (opening['selfClosing']) return err({ code: 'E023', params: { reason: 'selfClosing' } });
  const rawChildren = Array.isArray(targetNode['children']) ? targetNode['children'] : [];
  const currentText = parseText(rawChildren);
  if (currentText.kind === 'expression')
    return err({ code: 'E023', params: { reason: 'textExpression' } });
  if (currentText.kind === 'mixed') return err({ code: 'E023', params: { reason: 'textMixed' } });
  const currentVal = currentText.kind === 'static' ? currentText.value : '';
  if (edit.before !== currentVal) return err({ code: 'E017', params: { reason: 'valueChanged' } });
  if (currentVal === edit.after) return ok({ unchanged: true });
  mutateText(s, code, targetNode, edit.after, newline);
  return ok({});
}

export function applyFlagMutation(
  edit: SetFlagEdit,
  rawAttrs: readonly unknown[],
  opening: AstNode,
  code: string,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  const attrName = edit.name;
  const attrs = rawAttrs
    .map(asAstNode)
    .filter((a): a is AstNode => a !== undefined && a.type === 'JSXAttribute');

  const existingAttr = attrs.find((a) => {
    const nameNode = asAstNode(a['name']);
    return nameNode?.['name'] === attrName;
  });

  const isCurrentlyOn = Boolean(existingAttr);
  if (isCurrentlyOn === edit.on) {
    return ok({ unchanged: true });
  }

  mutateFlag(s, code, opening, attrName, edit.on);
  return ok({});
}

export function applySetTagMutation(
  edit: SetTagEdit,
  targetNode: AstNode,
  opening: AstNode,
  s: MagicString,
): Result<{ unchanged?: boolean }> {
  const currentTag = getJsxTagName(opening);
  if (
    currentTag === undefined ||
    currentTag === '' ||
    /^[A-Z]/.test(currentTag) ||
    /^[A-Z]/.test(edit.after)
  ) {
    return err({ code: 'E023', params: { reason: 'componentTag' } });
  }
  if (!(HTML_SETTABLE_TAGS as readonly string[]).includes(edit.after)) {
    return err({ code: 'E023', params: { reason: 'invalidTag' } });
  }
  if (VOID_HTML_TAGS.has(currentTag) || VOID_HTML_TAGS.has(edit.after)) {
    return err({ code: 'E023', params: { reason: 'voidTagMismatch' } });
  }
  if (currentTag === edit.after) return ok({ unchanged: true });
  const openName = asAstNode(opening['name']);
  if (openName?.start === undefined || openName.end === undefined) {
    return err({ code: 'E023', params: { reason: 'invalidTagNode' } });
  }
  s.overwrite(openName.start, openName.end, edit.after);
  if (!opening['selfClosing']) {
    const closingEl = asAstNode(targetNode['closingElement']);
    const closeName = asAstNode(closingEl?.['name']);
    if (closeName?.start === undefined || closeName.end === undefined) {
      return err({ code: 'E023', params: { reason: 'invalidClosingTag' } });
    }
    s.overwrite(closeName.start, closeName.end, edit.after);
  }
  return ok({});
}

export function executeEditMutation(
  edit: SourceEdit,
  targetNode: AstNode,
  opening: AstNode,
  code: string,
  s: MagicString,
  newline: '\r\n' | '\n',
): Result<{ unchanged?: boolean }> {
  const rawAttrs = Array.isArray(opening['attributes']) ? opening['attributes'] : [];
  if (edit.kind === 'setClassName') {
    return applyClassNameMutation(edit, rawAttrs, opening, code, s);
  }
  if (edit.kind === 'setAttribute') {
    return applyAttributeMutation(edit, rawAttrs, opening, code, s);
  }
  if (edit.kind === 'setFlag') {
    return applyFlagMutation(edit, rawAttrs, opening, code, s);
  }
  if (edit.kind === 'setTag') {
    return applySetTagMutation(edit, targetNode, opening, s);
  }
  if (edit.kind === 'setProp') {
    return applySetPropMutation(edit, rawAttrs, opening, code, s);
  }
  if (edit.kind === 'setTextRun') {
    return applySetTextRunMutation(edit, targetNode, opening, code, s);
  }
  return applyTextMutation(edit, targetNode, opening, code, s, newline);
}

export function parseModifiedCode(code: string): Result<AstNode> {
  try {
    return ok(parseJsxAst(code));
  } catch (e) {
    const syntaxErr = e as { loc?: { line?: number; column?: number } };
    return err({
      code: 'E024',
      params: {
        line: syntaxErr.loc?.line ?? 1,
        column: (syntaxErr.loc?.column ?? 0) + 1,
      },
    });
  }
}
