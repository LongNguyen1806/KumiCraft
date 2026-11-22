// Common types and validation for page operations (R-PG-11 to R-PG-14).
import { type AppError, err, ok, type Result, type RouterStatus } from '@kumicraft/shared';

import type {
  AddPageInput,
  DeletePageInput,
  PageEditDeps,
  RenamePageInput,
} from '../../../../kernel/features.ts';
import { withFileLocks } from '../../../../kernel/file-writer.ts';
import { checkPathSyntax, isInside } from '../../../../kernel/paths.ts';
import type { Platform } from '../../../../kernel/session.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../../../../lib/ast-helpers.ts';
import { applyTextEdits, type TextEdit } from '../structure/text-edits.ts';

export function routerNotSupportedError(router: RouterStatus): AppError {
  if (router.status === 'ambiguous') {
    return { code: 'E016', params: { reason: 'routerAmbiguous' } };
  }
  if (router.status === 'unsupported') {
    return { code: 'E016', params: { reason: 'routerUnsupported' } };
  }
  return { code: 'E016', params: { reason: 'routerMissing' } };
}

function findComponentIdNode(ast: AstNode, oldName: string): AstNode | undefined {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ExportNamedDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'FunctionDeclaration') {
        const id = asAstNode(decl['id']);
        if (id?.['name'] === oldName) return id;
      } else if (decl?.type === 'VariableDeclaration') {
        const decls = Array.isArray(decl['declarations']) ? decl['declarations'] : [];
        for (const d of decls) {
          const varId = asAstNode(asAstNode(d)?.['id']);
          if (varId?.['name'] === oldName) return varId;
        }
      }
    } else if (stmt?.type === 'ExportDefaultDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'FunctionDeclaration') {
        const id = asAstNode(decl['id']);
        if (id?.['name'] === oldName) return id;
      }
    }
  }
  return undefined;
}

export function renameComponentInPageCode(
  code: string,
  oldName: string,
  newName: string,
): Result<string> {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  }
  const targetIdNode = findComponentIdNode(ast, oldName);
  if (
    !targetIdNode ||
    typeof targetIdNode.start !== 'number' ||
    typeof targetIdNode.end !== 'number'
  ) {
    return err({ code: 'E023', params: { reason: 'componentNotFound' } });
  }

  const edits: TextEdit[] = [{ start: targetIdNode.start, end: targetIdNode.end, text: newName }];
  const applied = applyTextEdits(code, edits);
  if (!applied.ok) return applied;
  return ok(applied.value.code);
}

export function escapeJsxText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;');
}

export function normalizeRoute(raw: string): string {
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function validateRouteSyntax(route: string): boolean {
  if (route.includes('//') || !/^\/[a-z0-9\-/:]*$/.test(route) || route === '') {
    return false;
  }
  return true;
}

export function validateDirectory(
  dir: string,
  sourceDir: string,
  platform: Platform,
): Result<void> {
  if (!isInside(sourceDir, dir, platform)) {
    return err({ code: 'E012', params: { path: dir, reason: 'outsideRoot' } });
  }
  const segments = dir.split(/[\\/]/);
  if (segments.includes('..') || segments.includes('node_modules')) {
    return err({ code: 'E012', params: { path: dir, reason: 'outsideRoot' } });
  }
  const syntaxErr = checkPathSyntax(dir, platform);
  if (syntaxErr) return err(syntaxErr);
  return ok(undefined);
}

export type { AddPageInput, DeletePageInput, PageEditDeps, RenamePageInput };
export { withFileLocks };
