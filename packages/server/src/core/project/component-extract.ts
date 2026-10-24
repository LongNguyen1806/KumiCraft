// Extracting a JSX element into a new component (SPEC-04 section 18A, R-CP-14, spec-log #24).
import {
  err,
  type ExtractComponent,
  ok,
  pageNames,
  parseLocString,
  type Result,
  type StructureResult,
} from '@kumicraft/shared';

import { computeSha256 } from '../history/history-service.ts';
import {
  asAstNode,
  type AstNode,
  detectFormat,
  getJsxTagName,
  parseJsxAst,
} from '../source-editor/ast-helpers.ts';
import { readAliasPrefix } from '../source-editor/component-usages.ts';
import { findNodeAt } from '../source-editor/source-editor-lookup.ts';
import { collectMatchingImportStatements } from '../source-editor/structure/element-text.ts';
import {
  findImportInsertPosition,
  getTopLevelIdentifiers,
} from '../source-editor/structure/imports.ts';
import { isElementLoopRoot } from '../source-editor/structure/structure-guard.ts';
import { indentOf } from '../source-editor/structure/structure-ops.ts';
import { applyTextEdits } from '../source-editor/structure/text-edits.ts';
import { checkScopeUsage, remapImportStatement } from './component-scope.ts';
import { buildImportSource } from './components-list.ts';
import { type PageEditDeps, validateDirectory, withFileLocks } from './page-common.ts';

type ValidatedInput = {
  readonly name: string;
  readonly newFileRel: string;
  readonly sourceRel: string;
  readonly line: number;
  readonly column: number;
};

async function validateExtractInput(
  deps: PageEditDeps,
  input: ExtractComponent,
): Promise<Result<ValidatedInput>> {
  const names = pageNames(input.name, deps.language);
  const name = names.component;
  const targetDir = input.dir ?? deps.designDirs.components;
  const dirCheck = validateDirectory(targetDir, deps.sourceDir, deps.platform);
  if (!dirCheck.ok) return dirCheck;

  const fileName = input.fileName ?? `${name}.${deps.language === 'ts' ? 'tsx' : 'jsx'}`;
  if (!/^[A-Za-z0-9_-]+\.(tsx|jsx)$/.test(fileName)) {
    return err({ code: 'E016', params: { reason: 'invalidFileName' } });
  }
  const newFileRel = `${targetDir}/${fileName}`;
  if (await deps.fs.exists(deps.projectRoot, newFileRel)) {
    return err({ code: 'E016', params: { reason: 'fileExists' } });
  }

  const parsedLoc = parseLocString(input.loc);
  if (!parsedLoc) return err({ code: 'E017', params: { loc: input.loc, reason: 'moved' } });

  return ok({
    name,
    newFileRel,
    sourceRel: parsedLoc.file,
    line: parsedLoc.line,
    column: parsedLoc.column,
  });
}

function resolveTargetNode(
  sourceAst: AstNode,
  line: number,
  column: number,
  expectedTag: string,
  loc: string,
): Result<AstNode> {
  const targetNode = findNodeAt(sourceAst, line, column);
  if (!targetNode || targetNode.start === undefined || targetNode.end === undefined) {
    return err({ code: 'E017', params: { loc, reason: 'moved' } });
  }

  const opening = asAstNode(targetNode['openingElement']);
  const actualTag = opening ? getJsxTagName(opening) : undefined;
  if (actualTag !== expectedTag) {
    return err({ code: 'E017', params: { loc, reason: 'moved' } });
  }

  if (isElementLoopRoot(sourceAst, targetNode)) {
    return err({ code: 'E023', params: { reason: 'loopRoot', loc } });
  }
  return ok(targetNode);
}

function buildNewFileContent(
  name: string,
  rawJsx: string,
  baseIndent: string,
  imports: readonly string[],
  nl: '\r\n' | '\n',
): string {
  const lines = rawJsx.split(/\r?\n/);
  const indented = lines.map((line, idx) => {
    if (line.trim() === '') return '';
    if (idx === 0) return `    ${line}`;
    const stripped = line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line.trimStart();
    return `    ${stripped}`;
  });

  const parts: string[] = [];
  if (imports.length > 0) {
    parts.push(...imports);
    parts.push('');
  }
  parts.push(`export function ${name}() {`, '  return (', ...indented, '  );', '}', '');
  return parts.join(nl);
}

function computeLocFromOffset(code: string, offset: number, file: string): string {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset; i++) {
    if (code[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return `${file}:${String(line)}:${String(col)}`;
}

type PlannedEdits = {
  readonly newSourceCode: string;
  readonly newFileContent: string;
  readonly newLoc: string;
};

async function planExtractedEdits(
  deps: PageEditDeps,
  sourceAst: AstNode,
  sourceCode: string,
  targetNode: AstNode,
  validated: ValidatedInput,
  neededNames: ReadonlySet<string>,
): Promise<Result<PlannedEdits>> {
  const { name, newFileRel, sourceRel } = validated;
  const rawImports = collectMatchingImportStatements(sourceAst, sourceCode, [...neededNames]);
  const remappedImports = rawImports.map((stmt) =>
    remapImportStatement(stmt, sourceRel, newFileRel),
  );

  const format = detectFormat(sourceCode);
  const nl = format.newline;
  const baseIndent = indentOf(sourceCode, targetNode.start ?? 0);
  const rawJsx = sourceCode.slice(targetNode.start ?? 0, targetNode.end ?? 0);
  const newFileContent = buildNewFileContent(name, rawJsx, baseIndent, remappedImports, nl);

  const aliasPrefix = await readAliasPrefix(deps.fs, deps.projectRoot);
  const importSource = buildImportSource(newFileRel, aliasPrefix, sourceRel);
  const importStmt = `import { ${name} } from '${importSource}';`;

  const insertPos = findImportInsertPosition(sourceAst, sourceCode);
  const applied = applyTextEdits(sourceCode, [
    { start: insertPos, end: insertPos, text: `${importStmt}${nl}` },
    { start: targetNode.start ?? 0, end: targetNode.end ?? 0, text: `<${name} />`, mark: 0 },
  ]);
  if (!applied.ok) return applied;

  try {
    parseJsxAst(applied.value.code);
  } catch {
    return err({ code: 'E024', params: { line: 1 } });
  }

  const mark = applied.value.marks[0] ?? targetNode.start ?? 0;
  const newLoc = computeLocFromOffset(applied.value.code, mark, sourceRel);
  return ok({ newSourceCode: applied.value.code, newFileContent, newLoc });
}

export async function updateConfigComponents(
  deps: PageEditDeps,
  newFileRel: string,
): Promise<void> {
  const inComponents = newFileRel.startsWith(`${deps.designDirs.components}/`);
  const inLayouts = Boolean(
    deps.designDirs.layouts && newFileRel.startsWith(`${deps.designDirs.layouts}/`),
  );
  if (inComponents || inLayouts) return;

  const configPath = '.kumicraft/components.json';
  let files: string[] = [];
  const read = await deps.fs.readText(deps.projectRoot, configPath);
  if (read.ok) {
    try {
      const parsed = JSON.parse(read.value) as { files?: string[] };
      if (Array.isArray(parsed.files)) files = parsed.files.filter((f) => typeof f === 'string');
    } catch {
      files = [];
    }
  }
  if (!files.includes(newFileRel)) {
    files.push(newFileRel);
    await deps.fs.writeTextAtomic(
      deps.projectRoot,
      configPath,
      `${JSON.stringify({ files }, undefined, 2)}\n`,
    );
  }
}

type PreparedExtraction = {
  readonly name: string;
  readonly newFileRel: string;
  readonly newFileContent: string;
  readonly sourceRel: string;
  readonly sourceCode: string;
  readonly newSourceCode: string;
  readonly newLoc: string;
};

async function loadSourceAst(
  deps: PageEditDeps,
  sourceRel: string,
): Promise<Result<{ readonly sourceCode: string; readonly sourceAst: AstNode }>> {
  const read = await deps.fs.readText(deps.projectRoot, sourceRel, { keepBom: true });
  if (!read.ok) return read;
  try {
    const sourceAst = parseJsxAst(read.value);
    return ok({ sourceCode: read.value, sourceAst });
  } catch {
    return err({ code: 'E024', params: { line: 1 } });
  }
}

async function prepareExtract(
  deps: PageEditDeps,
  input: ExtractComponent,
): Promise<Result<PreparedExtraction>> {
  const valRes = await validateExtractInput(deps, input);
  if (!valRes.ok) return valRes;
  const validated = valRes.value;

  const loaded = await loadSourceAst(deps, validated.sourceRel);
  if (!loaded.ok) return loaded;
  const { sourceCode, sourceAst } = loaded.value;

  const targetRes = resolveTargetNode(
    sourceAst,
    validated.line,
    validated.column,
    input.tag,
    input.loc,
  );
  if (!targetRes.ok) return targetRes;
  const targetNode = targetRes.value;

  if (getTopLevelIdentifiers(sourceAst).has(validated.name)) {
    return err({ code: 'E016', params: { reason: 'nameExists' } });
  }

  const scopeRes = checkScopeUsage(targetNode, sourceAst);
  if (!scopeRes.ok) return scopeRes;

  const planned = await planExtractedEdits(
    deps,
    sourceAst,
    sourceCode,
    targetNode,
    validated,
    scopeRes.value,
  );
  if (!planned.ok) return planned;

  return ok({
    name: validated.name,
    newFileRel: validated.newFileRel,
    newFileContent: planned.value.newFileContent,
    sourceRel: validated.sourceRel,
    sourceCode,
    newSourceCode: planned.value.newSourceCode,
    newLoc: planned.value.newLoc,
  });
}

export async function extractComponent(
  deps: PageEditDeps,
  input: ExtractComponent,
): Promise<Result<StructureResult>> {
  const prep = await prepareExtract(deps, input);
  if (!prep.ok) return prep;
  const { name, newFileRel, newFileContent, sourceRel, sourceCode, newSourceCode, newLoc } =
    prep.value;

  return withFileLocks(deps.projectRoot, [sourceRel, newFileRel], async () => {
    const writeNew = await deps.fs.writeTextAtomic(deps.projectRoot, newFileRel, newFileContent);
    if (!writeNew.ok) return writeNew;

    const writeSource = await deps.fs.writeTextAtomic(deps.projectRoot, sourceRel, newSourceCode);
    if (!writeSource.ok) {
      await deps.fs.remove(deps.projectRoot, newFileRel);
      return writeSource;
    }

    const newHash = computeSha256(newFileContent);
    const sourceHash = computeSha256(newSourceCode);
    deps.history.recordInternalWrite(newFileRel, newHash);
    deps.history.recordInternalWrite(sourceRel, sourceHash);

    deps.history.push({
      label: { key: 'history:extract', params: { name } },
      files: [
        { path: newFileRel, after: newFileContent, afterHash: newHash },
        {
          path: sourceRel,
          before: sourceCode,
          beforeHash: computeSha256(sourceCode),
          after: newSourceCode,
          afterHash: sourceHash,
        },
      ],
    });

    await updateConfigComponents(deps, newFileRel);

    return ok({
      changed: true,
      files: [sourceRel, newFileRel],
      locs: [newLoc],
    });
  });
}
