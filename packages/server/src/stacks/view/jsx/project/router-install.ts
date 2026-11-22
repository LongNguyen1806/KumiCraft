// Server logic for POST /project/router/install (Phase 4 K3d-B section 3.5).
import { posix } from 'node:path';

import { err, ok, type Result } from '@kumicraft/shared';

import { commitFileChanges, type FileChange } from '../../../../kernel/file-writer.ts';
import type { HistoryService } from '../../../../kernel/history/history-service.ts';
import { asAstNode, type AstNode, isAstNode, parseJsxAst } from '../../../../lib/ast-helpers.ts';
import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import { applyTextEdits, type TextEdit } from '../structure/text-edits.ts';
import { withFileLocks } from './page-common.ts';
import { findRouter } from './route-finder.ts';
import { findEntryPoint } from './route-resolve.ts';

const REACT_ROUTER_VERSION = '7.18.4';

type EntryAnalysis = {
  readonly entryFile: string;
  readonly entryContent: string;
  readonly componentName: string;
  readonly jsxStart: number;
  readonly jsxEnd: number;
  readonly importStart: number;
  readonly importEnd: number;
  readonly importSpecifierCount: number;
  readonly importSource: string;
  readonly importKind: 'default' | 'named';
  readonly importedName: string;
};

function jsxTagName(opening: AstNode | undefined): string | undefined {
  const name = asAstNode(opening?.['name']);
  if (!name) return undefined;
  if (name.type === 'JSXIdentifier' && typeof name['name'] === 'string') return name['name'];
  if (name.type === 'JSXMemberExpression') {
    const obj = asAstNode(name['object']);
    const prop = asAstNode(name['property']);
    if (typeof obj?.['name'] === 'string' && typeof prop?.['name'] === 'string') {
      return `${obj['name']}.${prop['name']}`;
    }
  }
  return undefined;
}

function nonWhitespaceJsxChildren(element: AstNode): AstNode[] {
  const rawList = Array.isArray(element['children']) ? element['children'] : [];
  return rawList
    .map((raw) => asAstNode(raw))
    .filter(
      (child): child is AstNode =>
        child !== undefined &&
        !(child.type === 'JSXText' && typeof child['value'] === 'string' && !child['value'].trim()),
    );
}

function isSimpleRootComponentJsx(node: AstNode): { name: string; node: AstNode } | undefined {
  if (node.type !== 'JSXElement') return undefined;
  const opening = asAstNode(node['openingElement']);
  const attrs = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  if (attrs.length > 0 || nonWhitespaceJsxChildren(node).length > 0) return undefined;
  const tag = jsxTagName(opening);
  if (
    !tag ||
    !/^[A-Z][A-Za-z0-9_]*$/.test(tag) ||
    tag === 'StrictMode' ||
    tag === 'RouterProvider'
  ) {
    return undefined;
  }
  return { name: tag, node };
}

function extractRenderRootComponent(
  arg: AstNode | undefined,
): { name: string; node: AstNode } | undefined {
  if (!arg || arg.type !== 'JSXElement') return undefined;
  const direct = isSimpleRootComponentJsx(arg);
  if (direct) return direct;

  const opening = asAstNode(arg['openingElement']);
  const attrs = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  const tag = jsxTagName(opening);
  if (attrs.length > 0 || (tag !== 'StrictMode' && tag !== 'React.StrictMode')) return undefined;
  const children = nonWhitespaceJsxChildren(arg);
  return children.length === 1 && children[0] ? isSimpleRootComponentJsx(children[0]) : undefined;
}

function findRenderCallArgs(ast: AstNode): AstNode[] {
  const argsList: AstNode[] = [];
  function walk(n: unknown): void {
    if (Array.isArray(n)) {
      for (const item of n) walk(item);
      return;
    }
    if (!isAstNode(n)) return;
    if (n.type === 'CallExpression') {
      const callee = asAstNode(n['callee']);
      const prop = asAstNode(callee?.['property']);
      const obj = asAstNode(callee?.['object']);
      const args = Array.isArray(n['arguments']) ? n['arguments'] : [];
      if (
        callee?.type === 'MemberExpression' &&
        callee['computed'] !== true &&
        prop?.['name'] === 'render' &&
        obj?.type === 'CallExpression' &&
        args.length === 1
      ) {
        const firstArg = asAstNode(args[0]);
        if (firstArg) argsList.push(firstArg);
      }
    }
    for (const [k, v] of Object.entries(n)) {
      if (k !== 'loc' && k !== 'leadingComments' && k !== 'trailingComments') walk(v);
    }
  }
  walk(ast);
  return argsList;
}

function findComponentImport(ast: AstNode, componentName: string) {
  const program = asAstNode(ast['program']);
  const body = Array.isArray(program?.['body']) ? program['body'] : [];
  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const source = asAstNode(stmt['source'])?.['value'];
    if (typeof source !== 'string' || (!source.startsWith('.') && !source.startsWith('@/'))) {
      continue;
    }
    const specs = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    for (const raw of specs) {
      const spec = asAstNode(raw);
      if (asAstNode(spec?.['local'])?.['name'] !== componentName) continue;
      if (typeof stmt.start !== 'number' || typeof stmt.end !== 'number') return undefined;
      if (spec?.type === 'ImportDefaultSpecifier') {
        return {
          start: stmt.start,
          end: stmt.end,
          specifierCount: specs.length,
          source,
          kind: 'default' as const,
          importedName: componentName,
        };
      }
      if (spec?.type === 'ImportSpecifier') {
        const imported = asAstNode(spec['imported']);
        const importedName =
          typeof imported?.['name'] === 'string' ? imported['name'] : componentName;
        return {
          start: stmt.start,
          end: stmt.end,
          specifierCount: specs.length,
          source,
          kind: 'named' as const,
          importedName,
        };
      }
    }
  }
  return undefined;
}

async function analyzeEntryFile(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
): Promise<Result<EntryAnalysis>> {
  const unknownEntry = () =>
    err({ code: 'E016' as const, params: { reason: 'routerEntryUnknown' } });
  const entryFile = await findEntryPoint(fs, root, sourceDir);
  if (!entryFile) return unknownEntry();
  const read = await fs.readText(root, entryFile, { keepBom: true });
  if (!read.ok) return unknownEntry();

  let ast: AstNode;
  try {
    ast = parseJsxAst(read.value);
  } catch {
    return unknownEntry();
  }

  const renderArgs = findRenderCallArgs(ast);
  const target = renderArgs.length === 1 ? extractRenderRootComponent(renderArgs[0]) : undefined;
  if (!target || typeof target.node.start !== 'number' || typeof target.node.end !== 'number') {
    return unknownEntry();
  }
  const imp = findComponentImport(ast, target.name);
  if (!imp) return unknownEntry();

  return ok({
    entryFile,
    entryContent: read.value,
    componentName: target.name,
    jsxStart: target.node.start,
    jsxEnd: target.node.end,
    importStart: imp.start,
    importEnd: imp.end,
    importSpecifierCount: imp.specifierCount,
    importSource: imp.source,
    importKind: imp.kind,
    importedName: imp.importedName,
  });
}

function buildRoutesFileContent(analysis: EntryAnalysis, sourceDir: string, nl: string): string {
  let importPath = analysis.importSource;
  const entryDir = posix.dirname(analysis.entryFile);
  if (entryDir !== sourceDir && importPath.startsWith('.')) {
    const rel = posix.relative(sourceDir, posix.normalize(posix.join(entryDir, importPath)));
    importPath = rel.startsWith('.') ? rel : `./${rel}`;
  }
  const specStr =
    analysis.importKind === 'default'
      ? analysis.componentName
      : analysis.importedName === analysis.componentName
        ? `{ ${analysis.componentName} }`
        : `{ ${analysis.importedName} as ${analysis.componentName} }`;

  return [
    "import { createBrowserRouter } from 'react-router';",
    '',
    `import ${specStr} from '${importPath}';`,
    '',
    'export const router = createBrowserRouter([',
    '  {',
    "    path: '/',",
    `    element: <${analysis.componentName} />,`,
    '  },',
    ']);',
    '',
  ].join(nl);
}

function buildUpdatedEntryContent(
  analysis: EntryAnalysis,
  routesFile: string,
  nl: string,
): Result<string> {
  const hasExt = /\.(tsx|jsx|ts|js)$/.test(analysis.importSource);
  let relRoutes = posix.relative(posix.dirname(analysis.entryFile), routesFile);
  if (!relRoutes.startsWith('.')) relRoutes = `./${relRoutes}`;
  if (!hasExt) relRoutes = relRoutes.replace(/\.(tsx|jsx|ts|js)$/, '');

  const routerImports = [
    "import { RouterProvider } from 'react-router';",
    `import { router } from '${relRoutes}';`,
  ].join(nl);
  const stripped =
    analysis.entryContent.slice(0, analysis.importStart) +
    analysis.entryContent.slice(analysis.importEnd, analysis.jsxStart) +
    analysis.entryContent.slice(analysis.jsxEnd);
  const usedElsewhere = new RegExp(`\\b${analysis.componentName}\\b`).test(stripped);

  const edits: TextEdit[] = [
    { start: analysis.jsxStart, end: analysis.jsxEnd, text: '<RouterProvider router={router} />' },
    !usedElsewhere && analysis.importSpecifierCount === 1
      ? { start: analysis.importStart, end: analysis.importEnd, text: routerImports }
      : { start: analysis.importEnd, end: analysis.importEnd, text: `${nl}${routerImports}` },
  ];
  const applied = applyTextEdits(analysis.entryContent, edits);
  return applied.ok ? ok(applied.value.code) : applied;
}

export function insertRouterDependency(pkgRaw: string): Result<string> {
  const nl = pkgRaw.includes('\r\n') ? '\r\n' : '\n';
  const emptyDepsMatch = /^([ \t]*)"dependencies"\s*:\s*\{\s*\}/m.exec(pkgRaw);
  if (emptyDepsMatch) {
    const indent = emptyDepsMatch[1] ?? '  ';
    const replacement = `${indent}"dependencies": {${nl}${indent}  "react-router": "${REACT_ROUTER_VERSION}"${nl}${indent}}`;
    return ok(
      pkgRaw.slice(0, emptyDepsMatch.index) +
        replacement +
        pkgRaw.slice(emptyDepsMatch.index + emptyDepsMatch[0].length),
    );
  }
  const depsOpenMatch = /^([ \t]*)"dependencies"\s*:\s*\{[ \t]*(\r?\n)([ \t]*)/m.exec(pkgRaw);
  if (depsOpenMatch) {
    const propIndent = depsOpenMatch[3] || `${depsOpenMatch[1] ?? '  '}  `;
    const insertPos = depsOpenMatch.index + depsOpenMatch[0].length;
    return ok(
      pkgRaw.slice(0, insertPos) +
        `"react-router": "${REACT_ROUTER_VERSION}",${nl}${propIndent}` +
        pkgRaw.slice(insertPos),
    );
  }
  const lastBrace = pkgRaw.lastIndexOf('}');
  if (lastBrace === -1) return err({ code: 'E016', params: { reason: 'routerEntryUnknown' } });
  const beforeBrace = pkgRaw.slice(0, lastBrace).trimEnd();
  const comma = beforeBrace.endsWith('{') ? '' : ',';
  const block = `${comma}${nl}  "dependencies": {${nl}    "react-router": "${REACT_ROUTER_VERSION}"${nl}  }${nl}}`;
  return ok(beforeBrace + block + pkgRaw.slice(lastBrace + 1));
}

async function buildRouterInstallHistoryFiles(
  fs: FileSystemPort,
  root: string,
  sourceDir: string,
  language: 'ts' | 'js',
  hasRouterPackage: boolean,
): Promise<Result<readonly FileChange[]>> {
  const analysisRes = await analyzeEntryFile(fs, root, sourceDir);
  if (!analysisRes.ok) return analysisRes;
  const analysis = analysisRes.value;

  const isTsEntry = analysis.entryFile.endsWith('.tsx') || analysis.entryFile.endsWith('.ts');
  const isJsEntry = analysis.entryFile.endsWith('.jsx') || analysis.entryFile.endsWith('.js');
  const ext = isTsEntry ? 'tsx' : isJsEntry || language === 'js' ? 'jsx' : 'tsx';
  const routesFile = `${sourceDir}/routes.${ext}`;
  if (await fs.exists(root, routesFile)) {
    return err({ code: 'E016', params: { reason: 'routerExists' } });
  }

  const nl = analysis.entryContent.includes('\r\n') ? '\r\n' : '\n';
  const routesContent = buildRoutesFileContent(analysis, sourceDir, nl);
  const nextEntryRes = buildUpdatedEntryContent(analysis, routesFile, nl);
  if (!nextEntryRes.ok) return nextEntryRes;

  const changes: FileChange[] = [
    { path: routesFile, before: undefined, after: routesContent },
    { path: analysis.entryFile, before: analysis.entryContent, after: nextEntryRes.value },
  ];

  if (!hasRouterPackage) {
    const pkgRead = await fs.readText(root, 'package.json', { keepBom: true });
    if (!pkgRead.ok) return pkgRead;
    const nextPkgRes = insertRouterDependency(pkgRead.value);
    if (!nextPkgRes.ok) return nextPkgRes;
    changes.push({ path: 'package.json', before: pkgRead.value, after: nextPkgRes.value });
  }
  return ok(changes);
}

async function commitRouterInstallFiles(
  fs: FileSystemPort,
  history: HistoryService,
  root: string,
  changes: readonly FileChange[],
): Promise<Result<undefined>> {
  return withFileLocks(
    root,
    changes.map((f) => f.path),
    async () => {
      const committed = await commitFileChanges({ fs, history }, root, changes, {
        label: { key: 'history:routerInstall' },
      });
      return committed.ok ? ok(undefined) : committed;
    },
  );
}

/** The routes file, the entry and package.json, written as one Undo step (R-RT-04). */
export async function writeRouterFiles(
  deps: { readonly fs: FileSystemPort; readonly history: HistoryService },
  project: {
    readonly root: string;
    readonly sourceDir: string;
    readonly routingFile?: string | undefined;
    readonly language: 'ts' | 'js';
  },
): Promise<Result<void>> {
  const { root, sourceDir } = project;
  const router = await findRouter(deps.fs, root, sourceDir, project.routingFile);
  if (router.status !== 'none') return err({ code: 'E016', params: { reason: 'routerExists' } });

  const filesRes = await buildRouterInstallHistoryFiles(
    deps.fs,
    root,
    sourceDir,
    project.language,
    router.hasRouterPackage,
  );
  if (!filesRes.ok) return filesRes;
  return commitRouterInstallFiles(deps.fs, deps.history, root, filesRes.value);
}
