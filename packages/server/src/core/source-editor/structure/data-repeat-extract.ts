// AST analysis, slot extraction, and literal formatting helpers for TK-31 & TK-32.
import type { DataArrayRow, DataPrimitiveValue } from '@kumicraft/shared';

import { asAstNode, type AstNode, getJsxTagName, parseJsxAst } from '../ast-helpers.ts';

export type ExtractedSlot = {
  readonly start: number;
  readonly end: number;
  readonly kind: 'text' | 'attr';
  readonly fieldName: string;
  readonly defaultValue: string;
};

export function formatJsValue(val: DataPrimitiveValue): string {
  if (typeof val === 'string') return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return String(val);
}

export function formatDataArrayLiteral(
  rows: readonly DataArrayRow[],
  newline: '\r\n' | '\n',
): string {
  if (rows.length === 0) return '[]';
  const formattedRows = rows.map((row) => {
    const entries = Object.entries(row).map(([k, v]) => `    ${k}: ${formatJsValue(v)},`);
    return `  {${newline}${entries.join(newline)}${newline}  },`;
  });
  return `[${newline}${formattedRows.join(newline)}${newline}]`;
}

export function buildDataFileContent(
  exportName: string,
  rows: readonly DataArrayRow[],
  newline: '\r\n' | '\n',
): string {
  return `export const ${exportName} = ${formatDataArrayLiteral(rows, newline)};${newline}`;
}

/** Finds direct AST parent of `targetNode`, unwrapping ParenthesizedExpression. */
export function isDirectReturnRoot(ast: AstNode, targetNode: AstNode): boolean {
  let result = false;
  function walk(node: unknown, parentType: string | undefined): void {
    const astN = asAstNode(node);
    if (!astN || result) return;
    if (astN === targetNode) {
      if (parentType === 'ReturnStatement' || parentType === 'ArrowFunctionExpression') {
        result = true;
      }
      return;
    }
    const nextParent = astN.type === 'ParenthesizedExpression' ? parentType : astN.type;
    for (const key of Object.keys(astN)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      const child = astN[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item, nextParent);
      } else if (child !== undefined && typeof child === 'object') {
        walk(child, nextParent);
      }
    }
  }
  walk(ast['program'], undefined);
  return result;
}

/** Returns true if `targetNode` contains non-static JSX expressions outside className. */
export function hasComplexExpression(targetNode: AstNode): boolean {
  let found = false;
  function walk(node: unknown, attrName?: string): void {
    const astN = asAstNode(node);
    if (!astN || found) return;
    if (astN.type === 'JSXSpreadAttribute' || astN.type === 'JSXSpreadChild') {
      found = true;
      return;
    }
    if (astN.type === 'JSXAttribute') {
      const name = asAstNode(astN['name'])?.['name'];
      const val = asAstNode(astN['value']);
      if (val?.type === 'JSXExpressionContainer' && name !== 'className') {
        found = true;
        return;
      }
      if (val && name === 'className' && val.type === 'JSXExpressionContainer') {
        const expr = asAstNode(val['expression']);
        if (expr?.type !== 'StringLiteral') {
          found = true;
          return;
        }
      }
    }
    if (astN.type === 'JSXExpressionContainer' && attrName !== 'className') {
      const expr = asAstNode(astN['expression']);
      if (expr?.type !== 'JSXEmptyExpression') {
        found = true;
        return;
      }
    }
    for (const key of Object.keys(astN)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      const child = astN[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item, attrName);
      } else if (child !== undefined && typeof child === 'object') {
        walk(child, attrName);
      }
    }
  }
  walk(targetNode);
  return found;
}

function pickUniqueFieldName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let idx = 2;
  while (used.has(`${base}${String(idx)}`)) idx++;
  const chosen = `${base}${String(idx)}`;
  used.add(chosen);
  return chosen;
}

function baseTextFieldName(parentTag: string | undefined, used: ReadonlySet<string>): string {
  if (parentTag && /^h[1-6]$/.test(parentTag)) return 'title';
  if (parentTag === 'p') return 'description';
  if (parentTag === 'a' || parentTag === 'button') return 'label';
  return used.has('title') ? 'text' : 'title';
}

const REPEATABLE_ATTRS: Readonly<Record<string, string>> = {
  src: 'image',
  href: 'link',
  alt: 'alt',
};

function extractAttrSlotsFromOpening(
  opening: AstNode | undefined,
  used: Set<string>,
  slots: ExtractedSlot[],
): void {
  const attrs = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  for (const rawA of attrs) {
    const a = asAstNode(rawA);
    if (a?.type !== 'JSXAttribute') continue;
    const name = asAstNode(a['name'])?.['name'];
    const val = asAstNode(a['value']);
    const base = typeof name === 'string' ? REPEATABLE_ATTRS[name] : undefined;
    if (
      base !== undefined &&
      val?.type === 'StringLiteral' &&
      typeof val['value'] === 'string' &&
      val['value'].length > 0 &&
      typeof val.start === 'number' &&
      typeof val.end === 'number'
    ) {
      slots.push({
        start: val.start,
        end: val.end,
        kind: 'attr',
        fieldName: pickUniqueFieldName(base, used),
        defaultValue: val['value'],
      });
    }
  }
}

function extractTextSlot(
  astN: AstNode,
  currentTag: string | undefined,
  used: Set<string>,
  slots: ExtractedSlot[],
): void {
  if (
    astN.type !== 'JSXText' ||
    typeof astN['value'] !== 'string' ||
    typeof astN.start !== 'number' ||
    typeof astN.end !== 'number'
  ) {
    return;
  }
  const trimmed = astN['value'].trim();
  if (trimmed.length === 0) return;
  const leadLen = astN['value'].length - astN['value'].trimStart().length;
  const trailLen = astN['value'].length - astN['value'].trimEnd().length;
  slots.push({
    start: astN.start + leadLen,
    end: astN.end - trailLen,
    kind: 'text',
    fieldName: pickUniqueFieldName(baseTextFieldName(currentTag, used), used),
    defaultValue: trimmed,
  });
}

export function extractRepeatableSlots(targetNode: AstNode): readonly ExtractedSlot[] {
  const slots: ExtractedSlot[] = [];
  const used = new Set<string>(['id']);

  function walk(node: unknown, currentTag: string | undefined): void {
    const astN = asAstNode(node);
    if (!astN) return;
    if (astN.type === 'JSXElement') {
      const opening = asAstNode(astN['openingElement']);
      const tag = opening ? getJsxTagName(opening) : currentTag;
      extractAttrSlotsFromOpening(opening, used, slots);
      const children = Array.isArray(astN['children']) ? astN['children'] : [];
      for (const ch of children) walk(ch, tag);
      return;
    }
    extractTextSlot(astN, currentTag, used, slots);
  }
  walk(targetNode, undefined);
  return slots;
}

export function buildRepeatedRows(
  slots: readonly ExtractedSlot[],
  count: number,
): readonly DataArrayRow[] {
  const rows: DataArrayRow[] = [];
  const urlFields = new Set(['image', 'link']);
  for (let i = 0; i < count; i++) {
    const row: Record<string, DataPrimitiveValue> = { id: String(i + 1) };
    for (const slot of slots) {
      if (row[slot.fieldName] !== undefined) continue;
      if (i === 0 || urlFields.has(slot.fieldName)) {
        row[slot.fieldName] = slot.defaultValue;
      } else {
        row[slot.fieldName] = `${slot.defaultValue} ${String(i + 1)}`;
      }
    }
    if (slots.length === 0) {
      row['label'] = `Mục ${String(i + 1)}`;
    }
    rows.push(row);
  }
  return rows;
}

export function readPrimitiveNode(node: AstNode): DataPrimitiveValue | undefined {
  if (node.type === 'StringLiteral' && typeof node['value'] === 'string') return node['value'];
  if (node.type === 'NumericLiteral' && typeof node['value'] === 'number') return node['value'];
  if (node.type === 'BooleanLiteral' && typeof node['value'] === 'boolean') return node['value'];
  if (node.type === 'UnaryExpression' && node['operator'] === '-') {
    const arg = asAstNode(node['argument']);
    if (arg?.type === 'NumericLiteral' && typeof arg['value'] === 'number') {
      return -arg['value'];
    }
  }
  return undefined;
}

function parseObjectRow(
  obj: AstNode,
): { readonly row: DataArrayRow } | { readonly invalidReason: string } {
  const row: Record<string, DataPrimitiveValue> = {};
  const props = Array.isArray(obj['properties']) ? obj['properties'] : [];
  for (const rawP of props) {
    const p = asAstNode(rawP);
    if (p?.type !== 'ObjectProperty' || p['computed'] === true) {
      return { invalidReason: 'nonStaticProperty' };
    }
    const key = asAstNode(p['key']);
    const valNode = asAstNode(p['value']);
    const kName =
      key?.type === 'Identifier'
        ? String(key['name'])
        : key?.type === 'StringLiteral'
          ? String(key['value'])
          : undefined;
    const val = valNode ? readPrimitiveNode(valNode) : undefined;
    if (!kName || val === undefined) return { invalidReason: 'nonPrimitiveValue' };
    row[kName] = val;
  }
  return { row };
}

function findExportedInitNode(ast: AstNode, exportName: string): AstNode | undefined {
  const body = asAstNode(ast['program'])?.['body'];
  for (const rawStmt of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(rawStmt);
    const decl =
      stmt?.type === 'ExportNamedDeclaration' ? asAstNode(stmt['declaration']) : undefined;
    if (decl?.type !== 'VariableDeclaration') continue;
    const decs = Array.isArray(decl['declarations']) ? decl['declarations'] : [];
    for (const rawD of decs) {
      const d = asAstNode(rawD);
      if (asAstNode(d?.['id'])?.['name'] === exportName) return asAstNode(d?.['init']);
    }
  }
  return undefined;
}

export function parseStaticDataArray(
  code: string,
  exportName: string,
):
  | {
      readonly initNode: AstNode;
      readonly columns: readonly string[];
      readonly rows: readonly DataArrayRow[];
    }
  | { readonly invalidReason: string } {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return { invalidReason: 'syntaxError' };
  }
  const initNode = findExportedInitNode(ast, exportName);
  if (!initNode || initNode.type !== 'ArrayExpression') {
    return { invalidReason: 'notArrayLiteral' };
  }
  const els = Array.isArray(initNode['elements']) ? initNode['elements'] : [];
  const rows: DataArrayRow[] = [];
  const colSet = new Set<string>();
  for (const rawEl of els) {
    const obj = asAstNode(rawEl);
    if (obj?.type !== 'ObjectExpression') return { invalidReason: 'nonObjectItem' };
    const rowOrErr = parseObjectRow(obj);
    if ('invalidReason' in rowOrErr) return rowOrErr;
    for (const k of Object.keys(rowOrErr.row)) colSet.add(k);
    rows.push(rowOrErr.row);
  }
  const columns = [...colSet].sort((a, b) => (a === 'id' ? -1 : b === 'id' ? 1 : 0));
  return { initNode, columns, rows };
}
