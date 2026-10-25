// Babel AST helpers for reading and editing tailwind.config.* (SPEC-04 R-ST-11).
import type { ThemeTokenKind } from '@kumicraft/shared';

import { asAstNode, type AstNode, detectIndentation } from '../../source-editor/ast-helpers.ts';

export const KIND_TO_TW3_GROUP: Readonly<Record<ThemeTokenKind, string>> = {
  color: 'colors',
  fontSize: 'fontSize',
  radius: 'borderRadius',
  font: 'fontFamily',
  shadow: 'boxShadow',
};

export type LocatedTw3Token = {
  readonly kind: ThemeTokenKind;
  readonly name: string;
  readonly value: string;
  readonly editable: boolean;
  readonly propNode: AstNode;
  readonly parentObject: AstNode;
  readonly valueNode: AstNode;
};

const WRAPPER_TYPES = new Set([
  'TSAsExpression',
  'TSTypeAssertion',
  'TSSatisfiesExpression',
  'ParenthesizedExpression',
]);

export function unwrapExpression(node: AstNode | undefined): AstNode | undefined {
  let curr = node;
  while (curr !== undefined && WRAPPER_TYPES.has(curr.type)) {
    curr = asAstNode(curr['expression']);
  }
  if (curr?.type === 'CallExpression') {
    const args = Array.isArray(curr['arguments']) ? curr['arguments'] : [];
    return unwrapExpression(asAstNode(args[0]));
  }
  return curr;
}

function findIdentifierInit(body: readonly unknown[], name: string): AstNode | undefined {
  for (const rawStmt of body) {
    const stmt = asAstNode(rawStmt);
    if (stmt?.type !== 'VariableDeclaration') continue;
    const decls = Array.isArray(stmt['declarations']) ? stmt['declarations'] : [];
    for (const rawDecl of decls) {
      const decl = asAstNode(rawDecl);
      const id = asAstNode(decl?.['id']);
      if (id?.type === 'Identifier' && id['name'] === name) {
        return unwrapExpression(asAstNode(decl?.['init']));
      }
    }
  }
  return undefined;
}

function isModuleExports(left: AstNode | undefined): boolean {
  if (left?.type !== 'MemberExpression') return false;
  const obj = asAstNode(left['object']);
  const prop = asAstNode(left['property']);
  if (obj?.type !== 'Identifier' || obj['name'] !== 'module') return false;
  return (
    (prop?.type === 'Identifier' && prop['name'] === 'exports') ||
    (prop?.type === 'StringLiteral' && prop['value'] === 'exports')
  );
}

export function findConfigObject(ast: AstNode): AstNode | undefined {
  const program = ast.type === 'File' ? asAstNode(ast['program']) : ast;
  const rawBody: unknown = program?.['body'];
  const body: readonly unknown[] = Array.isArray(rawBody) ? rawBody : [];

  for (const rawStmt of body) {
    const stmt = asAstNode(rawStmt);
    if (!stmt) continue;
    let candidate: AstNode | undefined;
    if (stmt.type === 'ExportDefaultDeclaration') {
      candidate = unwrapExpression(asAstNode(stmt['declaration']));
    } else if (stmt.type === 'ExpressionStatement') {
      const expr = asAstNode(stmt['expression']);
      if (expr?.type === 'AssignmentExpression' && isModuleExports(asAstNode(expr['left']))) {
        candidate = unwrapExpression(asAstNode(expr['right']));
      }
    }
    if (candidate?.type === 'Identifier' && typeof candidate['name'] === 'string') {
      candidate = findIdentifierInit(body, candidate['name']);
    }
    if (candidate?.type === 'ObjectExpression') return candidate;
  }
  return undefined;
}

export function objectProperties(obj: AstNode): AstNode[] {
  const raw = Array.isArray(obj['properties']) ? obj['properties'] : [];
  const res: AstNode[] = [];
  for (const item of raw) {
    const node = asAstNode(item);
    if (node?.type === 'ObjectProperty' && node['computed'] !== true) {
      res.push(node);
    }
  }
  return res;
}

export function propertyKeyName(prop: AstNode): string | undefined {
  const key = asAstNode(prop['key']);
  if (!key) return undefined;
  if (key.type === 'Identifier' && typeof key['name'] === 'string') return key['name'];
  if (key.type === 'StringLiteral' && typeof key['value'] === 'string') return key['value'];
  if (key.type === 'NumericLiteral' && typeof key['value'] === 'number')
    return String(key['value']);
  return undefined;
}

export function findObjectProperty(obj: AstNode, name: string): AstNode | undefined {
  return objectProperties(obj).find((p) => propertyKeyName(p) === name);
}

export function findObjectChild(obj: AstNode, name: string): AstNode | undefined {
  const prop = findObjectProperty(obj, name);
  const val = unwrapExpression(asAstNode(prop?.['value']));
  return val?.type === 'ObjectExpression' ? val : undefined;
}

function readFontArray(node: AstNode): string | undefined {
  const elements = Array.isArray(node['elements']) ? node['elements'] : [];
  if (elements.length === 0) return undefined;
  const parts: string[] = [];
  for (const el of elements) {
    const item = unwrapExpression(asAstNode(el));
    if (item?.type !== 'StringLiteral' || typeof item['value'] !== 'string') return undefined;
    parts.push(item['value']);
  }
  return parts.join(', ');
}

function collectColorProperty(
  prop: AstNode,
  parentObject: AstNode,
  editable: boolean,
  out: LocatedTw3Token[],
): void {
  const key = propertyKeyName(prop);
  const val = unwrapExpression(asAstNode(prop['value']));
  if (!key || !val) return;
  if (val.type === 'StringLiteral' && typeof val['value'] === 'string') {
    out.push({
      kind: 'color',
      name: key,
      value: val['value'],
      editable,
      propNode: prop,
      parentObject,
      valueNode: val,
    });
    return;
  }
  if (val.type === 'ObjectExpression') {
    for (const childProp of objectProperties(val)) {
      const childKey = propertyKeyName(childProp);
      const childVal = unwrapExpression(asAstNode(childProp['value']));
      if (
        !childKey ||
        childVal?.type !== 'StringLiteral' ||
        typeof childVal['value'] !== 'string'
      ) {
        continue;
      }
      const tokenName = childKey === 'DEFAULT' ? key : `${key}-${childKey}`;
      out.push({
        kind: 'color',
        name: tokenName,
        value: childVal['value'],
        editable,
        propNode: childProp,
        parentObject: val,
        valueNode: childVal,
      });
    }
  }
}

export function collectTokensInScope(scopeObj: AstNode, editable: boolean): LocatedTw3Token[] {
  const out: LocatedTw3Token[] = [];
  const kinds: readonly ThemeTokenKind[] = ['color', 'fontSize', 'radius', 'font', 'shadow'];
  for (const kind of kinds) {
    const groupObj = findObjectChild(scopeObj, KIND_TO_TW3_GROUP[kind]);
    if (!groupObj) continue;
    for (const prop of objectProperties(groupObj)) {
      if (kind === 'color') {
        collectColorProperty(prop, groupObj, editable, out);
        continue;
      }
      const key = propertyKeyName(prop);
      const val = unwrapExpression(asAstNode(prop['value']));
      if (!key || !val) continue;
      if (val.type === 'StringLiteral' && typeof val['value'] === 'string') {
        out.push({
          kind,
          name: key,
          value: val['value'],
          editable,
          propNode: prop,
          parentObject: groupObj,
          valueNode: val,
        });
      } else if (kind === 'font' && val.type === 'ArrayExpression') {
        const joined = readFontArray(val);
        if (joined !== undefined) {
          out.push({
            kind,
            name: key,
            value: joined,
            editable,
            propNode: prop,
            parentObject: groupObj,
            valueNode: val,
          });
        }
      }
    }
  }
  return out;
}

export function indentUnitOf(code: string): string {
  const info = detectIndentation(code, 1);
  return info.useTab ? '\t' : ' '.repeat(info.step);
}
