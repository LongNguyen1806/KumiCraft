// TypeScript interface/type data-source reader via ts-inspect child runner + static AST fallback (TK-33).
import type { DataField, DataFieldType, DataSourceItem } from '@kumicraft/shared';

import { asAstNode, type AstNode, parseJsxAst } from '../../lib/ast-helpers.ts';
import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import { humanizeFieldName, inferTextFieldType, normalizeFieldType } from './field-utils.ts';

export type TsRunnerDeps = {
  readonly fs: FileSystemPort;
  readonly process?: ProcessPort | undefined;
  readonly scriptPath?: string | undefined;
};

async function runTsInspectJson<T>(
  deps: TsRunnerDeps,
  projectRoot: string,
  payload: Record<string, unknown>,
): Promise<T | undefined> {
  if (!deps.process || !deps.scriptPath) return undefined;
  if (!(await deps.fs.exists(projectRoot, 'node_modules/typescript/package.json'))) {
    return undefined;
  }
  const child = deps.process.spawn(process.execPath, [deps.scriptPath, JSON.stringify(payload)], {
    cwd: projectRoot,
    timeoutMs: 30_000,
  });
  const out = await child.wait();
  const line = out.stdout.trim().split('\n').at(-1) ?? '';
  if (line.length === 0) return undefined;
  try {
    return JSON.parse(line) as T;
  } catch {
    return undefined;
  }
}

function collectAstInterfaces(
  code: string,
): readonly { name: string; members: readonly AstNode[] }[] {
  let ast: AstNode;
  try {
    ast = parseJsxAst(code);
  } catch {
    return [];
  }
  const body = asAstNode(ast['program'])?.['body'];
  const out: { name: string; members: readonly AstNode[] }[] = [];
  for (const rawStmt of Array.isArray(body) ? body : []) {
    const stmt = asAstNode(rawStmt);
    const decl = stmt?.type === 'ExportNamedDeclaration' ? asAstNode(stmt['declaration']) : stmt;
    const id = asAstNode(decl?.['id']);
    const name = typeof id?.['name'] === 'string' ? id['name'] : undefined;
    if (!decl || !name || name.endsWith('Props')) continue;
    if (decl.type === 'TSInterfaceDeclaration') {
      const ifaceBody = asAstNode(decl['body']);
      const members = Array.isArray(ifaceBody?.['body'])
        ? ifaceBody['body'].map(asAstNode).filter((n): n is AstNode => n !== undefined)
        : [];
      if (members.length > 0) out.push({ name, members });
    } else if (decl.type === 'TSTypeAliasDeclaration') {
      const ann = asAstNode(decl['typeAnnotation']);
      if (ann?.type === 'TSTypeLiteral') {
        const members = Array.isArray(ann['members'])
          ? ann['members'].map(asAstNode).filter((n): n is AstNode => n !== undefined)
          : [];
        if (members.length > 0) out.push({ name, members });
      }
    }
  }
  return out;
}

function classifyAstTypeNode(
  typeNode: AstNode | undefined,
  propName: string,
): { type: DataFieldType; options?: readonly string[] } {
  if (!typeNode) return { type: inferTextFieldType(propName) };
  if (typeNode.type === 'TSBooleanKeyword') return { type: 'boolean' };
  if (typeNode.type === 'TSNumberKeyword') return { type: 'number' };
  if (typeNode.type === 'TSTypeReference') {
    const name = asAstNode(typeNode['typeName'])?.['name'];
    if (name === 'Date') return { type: 'date' };
  }
  if (typeNode.type === 'TSUnionType' && Array.isArray(typeNode['types'])) {
    const members = typeNode['types']
      .map(asAstNode)
      .filter(
        (t): t is AstNode =>
          t !== undefined && t.type !== 'TSUndefinedKeyword' && t.type !== 'TSNullKeyword',
      );
    if (
      members.length > 0 &&
      members.every(
        (m) => m.type === 'TSLiteralType' && asAstNode(m['literal'])?.type === 'StringLiteral',
      )
    ) {
      const opts = members
        .map((m) => asAstNode(m['literal'])?.['value'])
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
      return { type: 'select', options: opts };
    }
    if (members.length === 1) return classifyAstTypeNode(members[0], propName);
  }
  return { type: inferTextFieldType(propName) };
}

export async function listTypeScriptSources(
  deps: TsRunnerDeps,
  projectRoot: string,
  tsFiles: readonly string[],
): Promise<readonly DataSourceItem[]> {
  if (tsFiles.length === 0) return [];
  const runnerRes = await runTsInspectJson<{ sources?: { file: string; name: string }[] }>(
    deps,
    projectRoot,
    { mode: 'listDataSources', root: projectRoot, files: tsFiles },
  );
  if (runnerRes?.sources && runnerRes.sources.length > 0) {
    return runnerRes.sources.map((s) => ({
      id: `typescript:${s.file}:${s.name}`,
      kind: 'typescript',
      name: s.name,
      file: s.file,
      label: `${s.name} (TypeScript)`,
    }));
  }

  const fallback: DataSourceItem[] = [];
  for (const file of tsFiles) {
    const read = await deps.fs.readText(projectRoot, file, { maxBytes: 512_000 });
    if (!read.ok) continue;
    for (const model of collectAstInterfaces(read.value)) {
      fallback.push({
        id: `typescript:${file}:${model.name}`,
        kind: 'typescript',
        name: model.name,
        file,
        label: `${model.name} (TypeScript)`,
      });
    }
  }
  return fallback;
}

export async function readTypeScriptFields(
  deps: TsRunnerDeps,
  projectRoot: string,
  file: string,
  name: string,
): Promise<readonly DataField[]> {
  const runnerRes = await runTsInspectJson<{
    fields?: {
      name: string;
      label: string;
      type: string;
      required: boolean;
      options?: readonly string[];
    }[];
  }>(deps, projectRoot, { mode: 'readDataSourceFields', root: projectRoot, file, name });

  if (runnerRes?.fields && runnerRes.fields.length > 0) {
    return runnerRes.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: normalizeFieldType(f.type, f.name),
      required: f.required,
      ...(f.options && f.options.length > 0 ? { options: f.options } : {}),
    }));
  }

  const read = await deps.fs.readText(projectRoot, file, { maxBytes: 512_000 });
  if (!read.ok) return [];
  const model = collectAstInterfaces(read.value).find((m) => m.name === name);
  if (!model) return [];
  const fields: DataField[] = [];
  for (const member of model.members) {
    if (member.type !== 'TSPropertySignature') continue;
    const keyNode = asAstNode(member['key']);
    const propName = keyNode?.type === 'Identifier' ? String(keyNode['name']) : undefined;
    if (!propName) continue;
    const ann = asAstNode(asAstNode(member['typeAnnotation'])?.['typeAnnotation']);
    const cls = classifyAstTypeNode(ann, propName);
    fields.push({
      name: propName,
      label: humanizeFieldName(propName),
      type: cls.type,
      required: member['optional'] !== true,
      ...(cls.options && cls.options.length > 0 ? { options: cls.options } : {}),
    });
  }
  return fields;
}
