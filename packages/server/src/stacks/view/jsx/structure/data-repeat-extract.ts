// Static data array parsing and literal formatting helpers (TK-32).
import type { DataArrayRow, DataPrimitiveValue } from '@kumicraft/shared';

import { asAstNode, type AstNode, parseJsxAst } from '../../../../lib/ast-helpers.ts';

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
