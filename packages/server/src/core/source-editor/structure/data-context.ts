// Enclosing `.map()` data-array context resolution for DataGrid inspector (TK-32).
import * as posixPath from 'node:path/posix';

import type { ElementDataContext } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import { asAstNode, type AstNode } from '../ast-helpers.ts';
import { parseStaticDataArray } from './data-repeat-extract.ts';

function findEnclosingDataMap(
  ast: AstNode,
  targetNode: AstNode,
): { readonly localArrayName: string } | undefined {
  let result: { localArrayName: string } | undefined;
  function walk(node: unknown, mapTarget: string | undefined): void {
    const astN = asAstNode(node);
    if (!astN || result) return;
    let nextTarget = mapTarget;
    if (astN.type === 'CallExpression') {
      const callee = asAstNode(astN['callee']);
      const prop = asAstNode(callee?.['property']);
      const obj = asAstNode(callee?.['object']);
      if (
        (prop?.['name'] === 'map' || prop?.['name'] === 'flatMap') &&
        obj?.type === 'Identifier' &&
        typeof obj['name'] === 'string'
      ) {
        nextTarget = obj['name'];
      }
    }
    if (astN === targetNode) {
      if (nextTarget !== undefined) result = { localArrayName: nextTarget };
      return;
    }
    for (const key of Object.keys(astN)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') continue;
      const child = astN[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item, nextTarget);
      } else if (child !== undefined && typeof child === 'object') {
        walk(child, nextTarget);
      }
    }
  }
  walk(ast['program'], undefined);
  return result;
}

function findImportedArraySource(
  ast: AstNode,
  localName: string,
): { readonly spec: string; readonly importedName: string } | undefined {
  const body = asAstNode(ast['program'])?.['body'];
  for (const rawStmt of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(rawStmt);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const spec = asAstNode(stmt['source'])?.['value'];
    if (typeof spec !== 'string') continue;
    const specs = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    for (const rawS of specs) {
      const s = asAstNode(rawS);
      if (s?.type === 'ImportSpecifier' && asAstNode(s['local'])?.['name'] === localName) {
        const importedName = asAstNode(s['imported'])?.['name'];
        return {
          spec,
          importedName: typeof importedName === 'string' ? importedName : localName,
        };
      }
    }
  }
  return undefined;
}

async function resolveDataFileRel(
  fs: FileSystemPort,
  projectRoot: string,
  fromRel: string,
  spec: string,
): Promise<string | undefined> {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return undefined;
  const base = spec.startsWith('@/')
    ? `src/${spec.slice(2)}`
    : posixPath.normalize(posixPath.join(posixPath.dirname(fromRel), spec));
  const candidates = /\.(ts|js|tsx|jsx)$/.test(base)
    ? [base]
    : [`${base}.ts`, `${base}.js`, `${base}.data.ts`, `${base}.data.js`];
  for (const cand of candidates) {
    if (/\.data\.(ts|js|tsx|jsx)$/.test(cand) && (await fs.exists(projectRoot, cand))) {
      return cand;
    }
  }
  return undefined;
}

/** Finds enclosing static `.data.ts` array bound via `.map()` around `targetNode`. */
export async function readDataContextForNode(
  fs: FileSystemPort,
  projectRoot: string,
  sourceRel: string,
  ast: AstNode,
  targetNode: AstNode,
): Promise<ElementDataContext | undefined> {
  const hit = findEnclosingDataMap(ast, targetNode);
  if (!hit) return undefined;
  const imp = findImportedArraySource(ast, hit.localArrayName);
  if (!imp) return undefined;
  const dataRel = await resolveDataFileRel(fs, projectRoot, sourceRel, imp.spec);
  if (!dataRel) return undefined;
  const read = await fs.readText(projectRoot, dataRel, { maxBytes: 1_000_000 });
  if (!read.ok) return undefined;
  const parsed = parseStaticDataArray(read.value, imp.importedName);
  if ('invalidReason' in parsed) {
    return {
      file: dataRel,
      exportName: imp.importedName,
      columns: [],
      rows: [],
      readonlyReason: parsed.invalidReason,
    };
  }
  return {
    file: dataRel,
    exportName: imp.importedName,
    columns: parsed.columns,
    rows: parsed.rows,
  };
}
