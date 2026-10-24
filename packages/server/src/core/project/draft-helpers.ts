// Draft AST and file analysis helpers (M-DR, R-DR-10 to R-DR-16).
import * as path from 'node:path';

import { err, ok, type Result } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { isInside } from '../shared/paths.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { type PageEditDeps } from './page-common.ts';
import { listCodeFiles } from './pages.ts';

export function hasDataRcFree(opening: AstNode | undefined): boolean {
  const attrs = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  return attrs.some((a) => {
    const attr = asAstNode(a);
    const attrName = asAstNode(attr?.['name']);
    return attrName?.['name'] === 'data-rc-free';
  });
}

export function checkRootElementFree(funcNode: AstNode): boolean {
  const bodyNode = asAstNode(funcNode['body']);
  if (!bodyNode) return false;
  if (bodyNode.type === 'BlockStatement') {
    const stmts = Array.isArray(bodyNode['body']) ? bodyNode['body'] : [];
    for (const s of stmts) {
      const stmt = asAstNode(s);
      if (stmt?.type === 'ReturnStatement') {
        const arg = asAstNode(stmt['argument']);
        if (arg?.type === 'JSXElement') {
          return hasDataRcFree(asAstNode(arg['openingElement']));
        }
      }
    }
  } else if (bodyNode.type === 'JSXElement') {
    return hasDataRcFree(asAstNode(bodyNode['openingElement']));
  }
  return false;
}

export type ExportedComponentInfo = {
  readonly name: string;
  readonly free: boolean;
  readonly idStart?: number | undefined;
  readonly idEnd?: number | undefined;
};

export function extractExportedComponentInfo(code: string): ExportedComponentInfo | undefined {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return undefined;
  }
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (!stmt) continue;
    if (stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'FunctionDeclaration') {
        const id = asAstNode(decl['id']);
        const name = typeof id?.['name'] === 'string' ? id['name'] : undefined;
        if (name) {
          const idStart = typeof id?.['start'] === 'number' ? id['start'] : undefined;
          const idEnd = typeof id?.['end'] === 'number' ? id['end'] : undefined;
          return {
            name,
            free: checkRootElementFree(decl),
            idStart,
            idEnd,
          };
        }
      }
    }
  }
  return undefined;
}

export function renameComponentInCode(code: string, newComponentName: string): Result<string> {
  const info = extractExportedComponentInfo(code);
  if (!info || info.idStart === undefined || info.idEnd === undefined) {
    return err({ code: 'E024', params: { line: 1 } });
  }
  const newCode = code.slice(0, info.idStart) + newComponentName + code.slice(info.idEnd);
  return ok(newCode);
}

export async function isDraftIgnored(
  fs: FileSystemPort,
  root: string,
  draftsDir: string,
): Promise<boolean> {
  const read = await fs.readText(root, '.gitignore');
  if (!read.ok) return false;
  const lines = read.value.split(/\r?\n/);
  const baseName = path.posix.basename(draftsDir);
  const patterns = new Set([
    draftsDir,
    `/${draftsDir}`,
    `${draftsDir}/`,
    `${draftsDir}/**`,
    baseName,
    `${baseName}/`,
  ]);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (patterns.has(trimmed)) return true;
  }
  return false;
}

function checkImportPointsToDraft(
  stmt: AstNode,
  fileDir: string,
  sourceDir: string,
  draftRel: string,
  draftNoExt: string,
): boolean {
  if (stmt.type !== 'ImportDeclaration') return false;
  const srcNode = asAstNode(stmt['source']);
  const src = typeof srcNode?.['value'] === 'string' ? srcNode['value'] : '';
  if (!src) return false;

  let resolved: string | undefined;
  if (src.startsWith('.')) {
    resolved = path.posix.normalize(path.posix.join(fileDir, src));
  } else if (src.startsWith('@/')) {
    resolved = path.posix.normalize(path.posix.join(sourceDir, src.slice(2)));
  }
  return resolved !== undefined && (resolved === draftRel || resolved === draftNoExt);
}

export async function isDraftInUse(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  draftFileRel: string,
): Promise<boolean> {
  const codeFiles = await listCodeFiles(fs, root, sourceDir);
  const draftsDir = path.posix.dirname(draftFileRel);
  const draftFileNoExt = draftFileRel.replace(/\.(tsx|jsx)$/, '');
  const draftBase = path.posix.basename(draftFileNoExt);

  for (const file of codeFiles) {
    if (file.startsWith(`${draftsDir}/`)) continue;
    const read = await fs.readText(root, file, { maxBytes: 1024 * 1024 });
    if (!read.ok) continue;
    if (!read.value.includes(draftBase) && !read.value.includes('drafts')) continue;

    let ast: AstNode;
    try {
      ast = parseJsxAst(read.value);
    } catch {
      continue;
    }

    const program = asAstNode(ast['program']);
    const body = Array.isArray(program?.['body']) ? program['body'] : [];
    const fileDir = path.posix.dirname(file);

    for (const item of body) {
      const stmt = asAstNode(item);
      if (
        stmt &&
        checkImportPointsToDraft(stmt, fileDir, sourceDir, draftFileRel, draftFileNoExt)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function validateDraftFileLocation(
  file: string,
  draftsDir: string,
  deps: PageEditDeps,
): Result<void> {
  const draftPrefix = `${draftsDir}/`;
  if (!file.startsWith(draftPrefix)) {
    return err({ code: 'E012', params: { loc: file } });
  }
  if (!isInside(draftsDir, file, deps.platform)) {
    return err({ code: 'E012', params: { loc: file } });
  }
  return ok(undefined);
}
