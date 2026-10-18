// Auto-import calculation for inserted/moved JSX components (SPEC-04 R-SE-23, section 4.5).
import * as path from 'node:path';

import { asAstNode, type AstNode, parseJsxAst } from '../ast-helpers.ts';
import type { TextEdit } from './text-edits.ts';

/**
 * Returns identifiers declared or imported at the top-level of target file AST.
 */
export function getTopLevelIdentifiers(targetAst: AstNode): ReadonlySet<string> {
  const ids = new Set<string>();
  const program = asAstNode(targetAst['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (!stmt) continue;

    if (stmt.type === 'ImportDeclaration') {
      const specifiers = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
      for (const spec of specifiers) {
        const local = asAstNode(asAstNode(spec)?.['local']);
        if (typeof local?.['name'] === 'string') ids.add(local['name']);
      }
    } else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') {
      const id = asAstNode(stmt['id']);
      if (typeof id?.['name'] === 'string') ids.add(id['name']);
    } else if (stmt.type === 'VariableDeclaration') {
      const decls = Array.isArray(stmt['declarations']) ? stmt['declarations'] : [];
      for (const decl of decls) {
        const id = asAstNode(asAstNode(decl)?.['id']);
        if (typeof id?.['name'] === 'string') ids.add(id['name']);
      }
    }
  }

  return ids;
}

type ParsedImport = {
  readonly raw: string;
  readonly source: string;
  readonly isType: boolean;
  readonly defaultSpecifier?: string | undefined;
  readonly namespaceSpecifier?: string | undefined;
  readonly namedSpecifiers: readonly { readonly imported: string; readonly local: string }[];
};

function parseSingleImportStatement(stmtStr: string): ParsedImport | undefined {
  try {
    const ast = parseJsxAst(stmtStr);
    const program = asAstNode(ast['program']);
    const body = Array.isArray(program?.['body']) ? program['body'] : [];
    const first = asAstNode(body[0]);
    if (!first || first.type !== 'ImportDeclaration') return undefined;

    const sourceNode = asAstNode(first['source']);
    const source = typeof sourceNode?.['value'] === 'string' ? sourceNode['value'] : '';
    const isType = first['importKind'] === 'type';
    const specifiers = Array.isArray(first['specifiers']) ? first['specifiers'] : [];

    let defaultSpecifier: string | undefined;
    let namespaceSpecifier: string | undefined;
    const namedSpecifiers: { imported: string; local: string }[] = [];

    for (const s of specifiers) {
      const node = asAstNode(s);
      if (!node) continue;
      const localNode = asAstNode(node['local']);
      const localName = typeof localNode?.['name'] === 'string' ? localNode['name'] : '';
      if (node.type === 'ImportDefaultSpecifier') {
        defaultSpecifier = localName;
      } else if (node.type === 'ImportNamespaceSpecifier') {
        namespaceSpecifier = localName;
      } else if (node.type === 'ImportSpecifier') {
        const importedNode = asAstNode(node['imported']);
        const importedName =
          typeof importedNode?.['name'] === 'string' ? importedNode['name'] : localName;
        namedSpecifiers.push({ imported: importedName, local: localName });
      }
    }

    return {
      raw: stmtStr.trim(),
      source,
      isType,
      defaultSpecifier,
      namespaceSpecifier,
      namedSpecifiers,
    };
  } catch {
    return undefined;
  }
}

function resolveRelativeImportSource(fromFile: string, targetFile: string, src: string): string {
  if (!src.startsWith('.')) return src;
  const fromDir = path.posix.dirname(fromFile);
  const targetDir = path.posix.dirname(targetFile);
  const absTargetOfImport = path.posix.normalize(path.posix.join(fromDir, src));
  let relToNew = path.posix.relative(targetDir, absTargetOfImport);
  if (!relToNew.startsWith('.')) {
    relToNew = `./${relToNew}`;
  }
  return relToNew;
}

function constructImportStatement(
  name: string,
  parsed: ParsedImport,
  targetSource: string,
): string {
  const typePrefix = parsed.isType ? 'type ' : '';
  if (parsed.defaultSpecifier === name) {
    return `import ${typePrefix}${name} from '${targetSource}';`;
  }
  if (parsed.namespaceSpecifier === name) {
    return `import ${typePrefix}* as ${name} from '${targetSource}';`;
  }
  const matchingNamed = parsed.namedSpecifiers.find((s) => s.local === name);
  if (matchingNamed) {
    const spec =
      matchingNamed.imported === matchingNamed.local
        ? name
        : `${matchingNamed.imported} as ${matchingNamed.local}`;
    return `import ${typePrefix}{ ${spec} } from '${targetSource}';`;
  }
  return `import ${typePrefix}{ ${name} } from '${targetSource}';`;
}

export type AutoImportResult = {
  readonly edits: readonly TextEdit[];
  readonly warnings: readonly string[];
};

/**
 * Finds insertion position for new imports: right after the last ImportDeclaration,
 * or at the beginning of code (after BOM).
 */
function findImportInsertPosition(ast: AstNode, code: string): number {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  let lastImportEnd = -1;

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ImportDeclaration' && stmt.end !== undefined) {
      if (stmt.end > lastImportEnd) lastImportEnd = stmt.end;
    }
  }

  if (lastImportEnd !== -1) {
    let pos = lastImportEnd;
    while (pos < code.length && code[pos] !== '\n') pos++;
    return pos < code.length && code[pos] === '\n' ? pos + 1 : lastImportEnd;
  }

  return 0;
}

export function buildMissingImportsEdits(
  targetAst: AstNode,
  targetCode: string,
  targetFile: string,
  neededTags: readonly string[],
  from: { readonly file: string; readonly imports: readonly string[] } | undefined,
  nl: '\r\n' | '\n',
): AutoImportResult {
  const existingIds = getTopLevelIdentifiers(targetAst);
  const missingTags = neededTags.filter((tag) => !existingIds.has(tag));
  if (missingTags.length === 0) {
    return { edits: [], warnings: [] };
  }

  const parsedFromImports = (from?.imports ?? [])
    .map(parseSingleImportStatement)
    .filter((p): p is ParsedImport => p !== undefined);

  const insertPos = findImportInsertPosition(targetAst, targetCode);
  const newImportLines: string[] = [];
  const warnings: string[] = [];

  for (const tag of missingTags) {
    const candidate = parsedFromImports.find(
      (p) =>
        p.defaultSpecifier === tag ||
        p.namespaceSpecifier === tag ||
        p.namedSpecifiers.some((s) => s.local === tag),
    );

    if (!candidate || !from) {
      warnings.push('missingImport');
      continue;
    }

    const remappedSource = resolveRelativeImportSource(from.file, targetFile, candidate.source);
    const statement = constructImportStatement(tag, candidate, remappedSource);

    // Only add if not already in file or already planned to add
    if (!targetCode.includes(statement) && !newImportLines.includes(statement)) {
      newImportLines.push(statement);
    }
  }

  if (newImportLines.length === 0) {
    return { edits: [], warnings };
  }

  const insertText =
    insertPos === 0 ? `${newImportLines.join(nl)}${nl}` : `${newImportLines.join(nl)}${nl}`;

  return {
    edits: [{ start: insertPos, end: insertPos, text: insertText }],
    warnings,
  };
}
