// In-memory AST mutations for Source Editor (R-SE-05..12).
import type {
  Result,
  SetAttributeEdit,
  SetClassNameEdit,
  SetFlagEdit,
  SetTextEdit,
  SourceEdit,
} from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';
import type MagicString from 'magic-string';

import { asAstNode, type AstNode } from './ast-helpers.ts';
import { parseJsxAst } from './ast-helpers.ts';
import { readClassName, readEditableAttributes } from './attribute-reader.ts';
import { parseText } from './source-editor-lookup.ts';
import { mutateAttribute, mutateFlag, mutateText } from './source-mutator.ts';

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
