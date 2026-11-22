// Static Babel AST parser for Zod z.object({...}) schemas (TK-33): zero code execution.
import type { DataField, DataFieldType, DataSourceItem } from '@kumicraft/shared';

import { asAstNode, type AstNode, parseJsxAst } from '../../lib/ast-helpers.ts';
import { humanizeFieldName, inferTextFieldType } from './field-utils.ts';

function isZodObjectCall(node: AstNode): AstNode | undefined {
  if (node.type !== 'CallExpression') return undefined;
  const callee = asAstNode(node['callee']);
  if (callee?.type !== 'MemberExpression') return undefined;
  const obj = asAstNode(callee['object']);
  const prop = asAstNode(callee['property']);
  if (obj?.type !== 'Identifier' || obj['name'] !== 'z') return undefined;
  if (prop?.type !== 'Identifier' || prop['name'] !== 'object') return undefined;
  const args = Array.isArray(node['arguments']) ? node['arguments'] : [];
  const first = asAstNode(args[0]);
  return first?.type === 'ObjectExpression' ? first : undefined;
}

function collectZodSchemasFromAst(
  code: string,
): readonly { readonly name: string; readonly objNode: AstNode }[] {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return [];
  }
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  const results: { name: string; objNode: AstNode }[] = [];

  for (const rawStmt of body) {
    const stmt = asAstNode(rawStmt);
    const decl = stmt?.type === 'ExportNamedDeclaration' ? asAstNode(stmt['declaration']) : stmt;
    if (decl?.type !== 'VariableDeclaration') continue;
    const declarators = Array.isArray(decl['declarations']) ? decl['declarations'] : [];
    for (const rawD of declarators) {
      const d = asAstNode(rawD);
      const id = asAstNode(d?.['id']);
      const init = asAstNode(d?.['init']);
      if (id?.type !== 'Identifier' || typeof id['name'] !== 'string' || !init) continue;
      const objNode = isZodObjectCall(init);
      if (objNode) results.push({ name: id['name'], objNode });
    }
  }
  return results;
}

function readStringArrayArg(callNode: AstNode): readonly string[] | undefined {
  const args = Array.isArray(callNode['arguments']) ? callNode['arguments'] : [];
  const first = asAstNode(args[0]);
  if (first?.type !== 'ArrayExpression') return undefined;
  const els = Array.isArray(first['elements']) ? first['elements'] : [];
  const vals = els
    .map(asAstNode)
    .filter((n): n is AstNode => n?.type === 'StringLiteral' && typeof n['value'] === 'string')
    .map((n) => String(n['value']));
  return vals.length > 0 ? vals : undefined;
}

function readNumberArg(callNode: AstNode): number | undefined {
  const args = Array.isArray(callNode['arguments']) ? callNode['arguments'] : [];
  const first = asAstNode(args[0]);
  return first?.type === 'NumericLiteral' && typeof first['value'] === 'number'
    ? first['value']
    : undefined;
}

function readStringArg(callNode: AstNode): string | undefined {
  const args = Array.isArray(callNode['arguments']) ? callNode['arguments'] : [];
  const first = asAstNode(args[0]);
  return first?.type === 'StringLiteral' && typeof first['value'] === 'string'
    ? first['value']
    : undefined;
}

type ZodChainStep = {
  readonly method: string;
  readonly call: AstNode;
  readonly targetObj: string | undefined;
};

function collectZodChain(expr: AstNode): readonly ZodChainStep[] | undefined {
  const chain: ZodChainStep[] = [];
  let cursor: AstNode | undefined = expr;
  while (cursor?.type === 'CallExpression') {
    const callee = asAstNode(cursor['callee']);
    if (callee?.type !== 'MemberExpression') return undefined;
    const prop = asAstNode(callee['property']);
    const obj = asAstNode(callee['object']);
    if (prop?.type !== 'Identifier' || typeof prop['name'] !== 'string') return undefined;
    chain.unshift({
      method: prop['name'],
      call: cursor,
      targetObj: obj?.type === 'Identifier' ? String(obj['name']) : undefined,
    });
    cursor = obj;
  }
  return chain[0]?.targetObj === 'z' ? chain : undefined;
}

function parseZodFieldChain(fieldName: string, expr: AstNode): DataField | undefined {
  const chain = collectZodChain(expr);
  if (!chain) return undefined;

  let required = true;
  let type: DataFieldType = inferTextFieldType(fieldName);
  let options: readonly string[] | undefined;
  let maxLength: number | undefined;
  let label = humanizeFieldName(fieldName);

  for (const step of chain) {
    if (step.method === 'boolean') type = 'boolean';
    else if (step.method === 'number') type = 'number';
    else if (step.method === 'date') type = 'date';
    else if (step.method === 'enum') {
      type = 'select';
      options = readStringArrayArg(step.call);
    } else if (step.method === 'email') type = 'email';
    else if (step.method === 'url') type = 'url';
    else if (step.method === 'max') {
      const n = readNumberArg(step.call);
      if (n !== undefined && n > 0 && type !== 'number') maxLength = Math.floor(n);
    } else if (step.method === 'describe') {
      label = readStringArg(step.call) ?? label;
    } else if (
      step.method === 'optional' ||
      step.method === 'nullable' ||
      step.method === 'nullish'
    ) {
      required = false;
    }
  }

  return {
    name: fieldName,
    label,
    type,
    required,
    ...(options ? { options } : {}),
    ...(maxLength !== undefined ? { maxLength } : {}),
  };
}

export function listZodSourcesInFile(file: string, code: string): readonly DataSourceItem[] {
  return collectZodSchemasFromAst(code).map((s) => ({
    id: `zod:${file}:${s.name}`,
    kind: 'zod',
    name: s.name,
    file,
    label: `${s.name} (Zod)`,
  }));
}

export function readZodFieldsFromFile(code: string, schemaName: string): readonly DataField[] {
  const schema = collectZodSchemasFromAst(code).find((s) => s.name === schemaName);
  if (!schema) return [];
  const props = Array.isArray(schema.objNode['properties']) ? schema.objNode['properties'] : [];
  const fields: DataField[] = [];
  for (const rawP of props) {
    const p = asAstNode(rawP);
    if (p?.type !== 'ObjectProperty') continue;
    const keyNode = asAstNode(p['key']);
    const valNode = asAstNode(p['value']);
    const keyName =
      keyNode?.type === 'Identifier'
        ? String(keyNode['name'])
        : keyNode?.type === 'StringLiteral'
          ? String(keyNode['value'])
          : undefined;
    if (!keyName || !valNode) continue;
    const field = parseZodFieldChain(keyName, valNode);
    if (field) fields.push(field);
  }
  return fields;
}
