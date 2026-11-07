// AST-guided code mutation using magic-string (R-SE-05, R-SE-06, R-SE-08, R-SE-09, R-SE-10, R-SE-17).
import type MagicString from 'magic-string';

import type { AstNode } from './ast-helpers.ts';
import { asAstNode, detectIndentation } from './ast-helpers.ts';
import { encodeJsxText } from './text-reader.ts';

/**
 * Removes an attribute node and cleans up whitespace / line (R-SE-06).
 */
export function removeAttribute(s: MagicString, code: string, attrNode: AstNode): void {
  const start = typeof attrNode.start === 'number' ? attrNode.start : 0;
  const end = typeof attrNode.end === 'number' ? attrNode.end : code.length;
  const locStart = attrNode.loc?.start;
  const locEnd = attrNode.loc?.end;

  const lines = code.split(/\r?\n/);
  const lineIdx = (locStart?.line ?? 1) - 1;
  const lineText = lines[lineIdx] ?? '';

  const colStart = locStart?.column ?? 0;
  const colEnd = locEnd?.column ?? lineText.length;

  const beforeCol = lineText.slice(0, colStart).trim();
  const afterCol = lineText.slice(colEnd).trim();

  // If the attribute is alone on this line, remove the entire line
  if (beforeCol === '' && afterCol === '') {
    const lineStart = start - (locStart?.column ?? 0);
    let lineEnd = end;
    while (lineEnd < code.length && code[lineEnd] !== '\n' && code[lineEnd] !== '\r') {
      lineEnd++;
    }
    if (code[lineEnd] === '\r' && code[lineEnd + 1] === '\n') {
      lineEnd += 2;
    } else if (code[lineEnd] === '\n') {
      lineEnd += 1;
    }
    s.remove(lineStart, lineEnd);
    return;
  }

  // Otherwise, delete attribute and preceding whitespace
  let removeStart = start;
  while (removeStart > 0 && (code[removeStart - 1] === ' ' || code[removeStart - 1] === '\t')) {
    removeStart--;
  }
  s.remove(removeStart, end);
}

function modifyCallExpressionArg(s: MagicString, expr: AstNode, after: string): boolean {
  const args = Array.isArray(expr['arguments']) ? expr['arguments'].map(asAstNode) : [];
  const firstArg = args[0];
  if (
    firstArg?.type === 'StringLiteral' &&
    typeof firstArg.start === 'number' &&
    typeof firstArg.end === 'number'
  ) {
    const quote = s.original[firstArg.start] ?? "'";
    if (after.includes(quote) || after.includes('\\') || after.includes('\n')) {
      s.overwrite(firstArg.start, firstArg.end, JSON.stringify(after));
    } else {
      s.overwrite(firstArg.start + 1, firstArg.end - 1, after);
    }
    return true;
  }
  if (firstArg?.type === 'TemplateLiteral') {
    const expressions = Array.isArray(firstArg['expressions']) ? firstArg['expressions'] : [];
    const quasis = Array.isArray(firstArg['quasis']) ? firstArg['quasis'] : [];
    if (expressions.length === 0 && quasis.length === 1) {
      const quasi = asAstNode(quasis[0]);
      if (quasi && typeof quasi.start === 'number' && typeof quasi.end === 'number') {
        const escaped = after.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
        s.overwrite(quasi.start + 1, quasi.end - 1, escaped);
        return true;
      }
    }
  }
  return false;
}

function modifyStringLiteral(
  s: MagicString,
  code: string,
  existingAttr: AstNode,
  valNode: AstNode,
  after: string,
): void {
  const vStart = valNode.start as number;
  const vEnd = valNode.end as number;
  const quote = code[vStart] ?? '"';
  if (after.includes(quote) || after.includes('\n')) {
    const nameNode = asAstNode(existingAttr['name']);
    const nameEnd = typeof nameNode?.end === 'number' ? nameNode.end : vStart;
    const attrEnd = typeof existingAttr.end === 'number' ? existingAttr.end : vEnd;
    s.overwrite(nameEnd, attrEnd, `={${JSON.stringify(after)}}`);
  } else {
    s.overwrite(vStart + 1, vEnd - 1, after);
  }
}

/**
 * `` `${a} b` `` or `cn('', cond && 'x')`: emptying the static classes keeps the attribute, since
 * the dynamic part is still there.
 */
function keepsDynamicPart(attr: AstNode | undefined): boolean {
  const value = asAstNode(attr?.['value']);
  if (value?.type !== 'JSXExpressionContainer') return false;
  const expr = asAstNode(value['expression']);
  if (expr?.type === 'TemplateLiteral') {
    return Array.isArray(expr['expressions']) && expr['expressions'].length > 0;
  }
  return expr?.type === 'CallExpression';
}

function escapeTemplate(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

/**
 * The text before the first `${` (or the whole template without one). Babel's quasi range
 * excludes the backticks and `${`. With an expression after it, the part keeps one space before
 * the `${` so the static and dynamic classes stay apart.
 */
function modifyTemplateStart(s: MagicString, code: string, expr: AstNode, after: string): boolean {
  const quasis = Array.isArray(expr['quasis']) ? expr['quasis'] : [];
  const expressions = Array.isArray(expr['expressions']) ? expr['expressions'] : [];
  const quasi = asAstNode(quasis[0]);
  if (!quasi || typeof quasi.start !== 'number' || typeof quasi.end !== 'number') return false;
  if (expressions.length === 0) {
    s.overwrite(quasi.start, quasi.end, escapeTemplate(after));
    return true;
  }
  const old = code.slice(quasi.start, quasi.end);
  const lead = /^\s*/.exec(old)?.[0] ?? '';
  const trail = /\s*$/.exec(old)?.[0] ?? '';
  const value = after.trim();
  const text = value === '' ? '' : `${lead}${escapeTemplate(value)}${trail === '' ? ' ' : trail}`;
  if (quasi.start === quasi.end) s.appendLeft(quasi.start, text);
  else s.overwrite(quasi.start, quasi.end, text);
  return true;
}

function modifyExistingAttribute(
  s: MagicString,
  code: string,
  existingAttr: AstNode,
  after: string,
): void {
  const valNode = asAstNode(existingAttr['value']);
  if (
    valNode?.type === 'StringLiteral' &&
    typeof valNode.start === 'number' &&
    typeof valNode.end === 'number'
  ) {
    modifyStringLiteral(s, code, existingAttr, valNode, after);
    return;
  }

  if (valNode?.type === 'JSXExpressionContainer') {
    const expr = asAstNode(valNode['expression']);
    if (
      expr?.type === 'StringLiteral' &&
      typeof expr.start === 'number' &&
      typeof expr.end === 'number'
    ) {
      s.overwrite(expr.start, expr.end, JSON.stringify(after));
      return;
    }
    if (expr?.type === 'TemplateLiteral') {
      if (modifyTemplateStart(s, code, expr, after)) return;
    }
    if (expr?.type === 'CallExpression') {
      modifyCallExpressionArg(s, expr, after);
    }
  }
}

function insertNewAttribute(
  s: MagicString,
  code: string,
  openingEl: AstNode,
  attrName: string,
  after: string,
): void {
  const nameNode = asAstNode(openingEl['name']);
  const nameEnd = typeof nameNode?.end === 'number' ? nameNode.end : 0;
  const quote =
    after.includes('"') || after.includes('\n') ? `={${JSON.stringify(after)}}` : `="${after}"`;

  if (attrName === 'className') {
    s.appendRight(nameEnd, ` className${quote}`);
    return;
  }

  const isSelfClosing = Boolean(openingEl['selfClosing']);
  const elStart = typeof openingEl.start === 'number' ? openingEl.start : 0;
  const elEnd = typeof openingEl.end === 'number' ? openingEl.end : code.length;
  let insertPos = elEnd - (isSelfClosing ? 2 : 1);
  while (insertPos > elStart && (code[insertPos - 1] === ' ' || code[insertPos - 1] === '\t')) {
    insertPos--;
  }

  s.appendLeft(insertPos, ` ${attrName}${quote}`);
}

/**
 * Updates or sets a static attribute value with proper escaping and quote preservation (R-SE-05, R-SE-06).
 */
export function mutateAttribute(
  s: MagicString,
  code: string,
  openingEl: AstNode,
  attrName: string,
  after: string | undefined,
): void {
  const rawAttrs = Array.isArray(openingEl['attributes']) ? openingEl['attributes'] : [];
  const attrs = rawAttrs
    .map(asAstNode)
    .filter((a): a is AstNode => a !== undefined && a.type === 'JSXAttribute');

  const existingAttr = attrs.find((a) => {
    const nameNode = asAstNode(a['name']);
    return nameNode?.['name'] === attrName;
  });

  const emptiesClass = attrName === 'className' && after === '' && !keepsDynamicPart(existingAttr);
  if (after === undefined || emptiesClass) {
    if (existingAttr) {
      removeAttribute(s, code, existingAttr);
    }
    return;
  }

  if (existingAttr) {
    modifyExistingAttribute(s, code, existingAttr, after);
    return;
  }

  insertNewAttribute(s, code, openingEl, attrName, after);
}

/**
 * Updates text content inside a JSXElement (R-SE-08).
 */
export function mutateText(
  s: MagicString,
  code: string,
  jsxEl: AstNode,
  after: string,
  newline: '\r\n' | '\n',
): void {
  const openingEl = asAstNode(jsxEl['openingElement']);
  const closingEl = asAstNode(jsxEl['closingElement']);
  const openingEnd = typeof openingEl?.end === 'number' ? openingEl.end : 0;
  const closingStart = typeof closingEl?.start === 'number' ? closingEl.start : undefined;
  if (closingStart === undefined) return;

  const currentRaw = code.slice(openingEnd, closingStart);
  const hadNewline = currentRaw.includes('\n');
  const encoded = encodeJsxText(after);

  if (!hadNewline) {
    s.overwrite(openingEnd, closingStart, encoded);
    return;
  }

  const closingLine = closingEl?.loc?.start?.line ?? 1;
  const indentInfo = detectIndentation(code, closingLine);
  const stepStr = indentInfo.useTab ? '\t' : ' '.repeat(indentInfo.step);
  const childIndent = `${indentInfo.openingIndent}${stepStr}`;

  const replacement = `${newline}${childIndent}${encoded}${newline}${indentInfo.openingIndent}`;
  s.overwrite(openingEnd, closingStart, replacement);
}

/**
 * Toggles a boolean flag attribute like `data-rc-free` on an opening element (R-FF-10).
 */
export function mutateFlag(
  s: MagicString,
  code: string,
  openingEl: AstNode,
  flagName: string,
  on: boolean,
): void {
  const rawAttrs = Array.isArray(openingEl['attributes']) ? openingEl['attributes'] : [];
  const attrs = rawAttrs
    .map(asAstNode)
    .filter((a): a is AstNode => a !== undefined && a.type === 'JSXAttribute');

  const existingAttr = attrs.find((a) => {
    const nameNode = asAstNode(a['name']);
    return nameNode?.['name'] === flagName;
  });

  if (!on) {
    if (existingAttr) {
      removeAttribute(s, code, existingAttr);
    }
    return;
  }

  if (existingAttr) {
    return;
  }

  const nameNode = asAstNode(openingEl['name']);
  const nameEnd = typeof nameNode?.end === 'number' ? nameNode.end : 0;
  s.appendRight(nameEnd, ` ${flagName}`);
}
