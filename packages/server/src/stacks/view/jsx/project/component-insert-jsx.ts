// The tag the Library inserts for a project component (R-CP-11, K9.5): its required props get a
// placeholder of their type, so `<ProductCard />` no longer breaks the project's type check
// (TS2739, found on a Test UI draft). Read from the source: the props type must be in the same
// file (an alias, an interface or an inline type); otherwise the bare tag is used.
import { asAstNode, type AstNode, parseJsxAst } from '../../../../lib/ast-helpers.ts';

type Member = {
  readonly name: string;
  readonly optional: boolean;
  readonly type?: AstNode | undefined;
};

function membersOf(typeNode: AstNode | undefined, aliases: Map<string, AstNode>): Member[] {
  if (!typeNode) return [];
  if (typeNode.type === 'TSTypeReference') {
    const name = asAstNode(typeNode['typeName'])?.['name'];
    return typeof name === 'string' ? membersOf(aliases.get(name), aliases) : [];
  }
  if (typeNode.type === 'TSIntersectionType') {
    const parts = Array.isArray(typeNode['types']) ? typeNode['types'] : [];
    return parts.flatMap((t) => membersOf(asAstNode(t), aliases));
  }
  const list = typeNode.type === 'TSTypeLiteral' ? typeNode['members'] : typeNode['body'];
  const body = asAstNode(list)?.['body'] ?? list;
  const items = Array.isArray(body) ? body : [];
  return items.flatMap((item): Member[] => {
    const m = asAstNode(item);
    const key = asAstNode(m?.['key']);
    if (m?.type !== 'TSPropertySignature' || typeof key?.['name'] !== 'string') return [];
    const type = asAstNode(asAstNode(m['typeAnnotation'])?.['typeAnnotation']);
    return [{ name: key['name'], optional: m['optional'] === true, type }];
  });
}

/** Type aliases and interfaces of the file, by name (their type body). */
function typeAliases(ast: AstNode): Map<string, AstNode> {
  const out = new Map<string, AstNode>();
  const body = asAstNode(ast['program'])?.['body'];
  for (const item of Array.isArray(body) ? body : []) {
    let stmt = asAstNode(item);
    if (stmt?.type === 'ExportNamedDeclaration') stmt = asAstNode(stmt['declaration']);
    const id = asAstNode(stmt?.['id'])?.['name'];
    if (typeof id !== 'string' || !stmt) continue;
    if (stmt.type === 'TSTypeAliasDeclaration') {
      const t = asAstNode(stmt['typeAnnotation']);
      if (t) out.set(id, t);
    } else if (stmt.type === 'TSInterfaceDeclaration') {
      out.set(id, stmt);
    }
  }
  return out;
}

/** The first parameter's type of the component `name` (function or arrow, exported or default). */
function propsType(ast: AstNode, name: string): AstNode | undefined {
  const body = asAstNode(ast['program'])?.['body'];
  for (const item of Array.isArray(body) ? body : []) {
    let stmt = asAstNode(item);
    if (stmt?.type === 'ExportNamedDeclaration' || stmt?.type === 'ExportDefaultDeclaration') {
      stmt = asAstNode(stmt['declaration']) ?? stmt;
    }
    let fn: AstNode | undefined;
    if (stmt?.type === 'FunctionDeclaration' && asAstNode(stmt['id'])?.['name'] === name) fn = stmt;
    if (stmt?.type === 'VariableDeclaration') {
      const decls = Array.isArray(stmt['declarations']) ? stmt['declarations'] : [];
      const decl = decls.map(asAstNode).find((d) => asAstNode(d?.['id'])?.['name'] === name);
      fn = asAstNode(decl?.['init']);
    }
    const params = Array.isArray(fn?.['params']) ? fn['params'] : [];
    const first = asAstNode(params[0]);
    if (first) return asAstNode(asAstNode(first['typeAnnotation'])?.['typeAnnotation']);
  }
  return undefined;
}

/** A value of the type that type-checks: text in quotes, 0, false, a no-op function, []. */
function placeholder(member: Member): string | undefined {
  const t = member.type;
  const label = member.name.charAt(0).toUpperCase() + member.name.slice(1);
  switch (t?.type) {
    case 'TSStringKeyword':
      return /src|href|url|image|icon/i.test(member.name) ? '""' : JSON.stringify(label);
    case 'TSNumberKeyword':
      return '{0}';
    case 'TSBooleanKeyword':
      return '{false}';
    case 'TSFunctionType':
      return '{() => {}}';
    case 'TSArrayType':
      return '{[]}';
    case 'TSUnionType': {
      const first = asAstNode(Array.isArray(t['types']) ? t['types'][0] : undefined);
      const lit = asAstNode(first?.['literal']);
      if (typeof lit?.['value'] === 'string') return JSON.stringify(lit['value']);
      if (typeof lit?.['value'] === 'number') return `{${String(lit['value'])}}`;
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * `<ProductCard name="Name" price="Price" />`, or `<Card>Card</Card>` when `children` is
 * required. Undefined: insert the bare tag (no required props, or one we cannot fill).
 */
export function insertJsxFor(code: string, name: string): string | undefined {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return undefined;
  }
  const required = membersOf(propsType(ast, name), typeAliases(ast)).filter((m) => !m.optional);
  if (required.length === 0) return undefined;
  const attrs: string[] = [];
  let children = false;
  for (const member of required) {
    if (member.name === 'children') {
      children = true;
      continue;
    }
    const value = placeholder(member);
    if (value === undefined) return undefined;
    attrs.push(`${member.name}=${value}`);
  }
  const open = [name, ...attrs].join(' ');
  return children ? `<${open}>${name}</${name}>` : `<${open} />`;
}
