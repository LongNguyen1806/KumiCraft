// Page source template learning from sibling files (SPEC-04 K3d section 3.4).
import * as path from 'node:path';

import { primarySystem, type StylingReport } from '@kumicraft/shared';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { asAstNode, type AstNode, parseJsxAst } from '../source-editor/ast-helpers.ts';
import { escapeJsxText } from './page-common.ts';
import { resolveImportPath } from './route-resolve.ts';

const MAX_SAMPLE_FILES = 10;

type ExportStyle = 'defaultFunc' | 'arrowDefault' | 'namedFunc';

type SampleInfo = {
  readonly file: string;
  readonly ext: 'jsx' | 'tsx';
  readonly exportStyle: ExportStyle;
  readonly layout?:
    | {
        readonly name: string;
        readonly resolvedFile: string;
        readonly isNamedImport: boolean;
        readonly importHasExt: boolean;
      }
    | undefined;
  readonly rootTag: string;
  readonly rootClassName?: string | undefined;
};

export type BuildPageSourceInput = {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly dir: string;
  readonly component: string;
  readonly name: string;
  readonly language: 'ts' | 'js';
  readonly styling?: StylingReport | undefined;
  readonly firstPagesDir?: string | undefined;
};

export type ResolvePageExtInput = {
  readonly fs: FileSystemPort;
  readonly root: string;
  readonly dir: string;
  readonly language: 'ts' | 'js';
  readonly firstPagesDir?: string | undefined;
};

function jsxName(node: AstNode | undefined): string | undefined {
  const opening = asAstNode(node?.['openingElement']);
  const name = asAstNode(opening?.['name']);
  return name?.type === 'JSXIdentifier' && typeof name['name'] === 'string'
    ? name['name']
    : undefined;
}

function findReturnedJsx(funcNode: AstNode): AstNode | undefined {
  const body = asAstNode(funcNode['body']);
  if (!body) return undefined;
  if (body.type === 'JSXElement') return body;
  if (body.type === 'BlockStatement') {
    const stmts: unknown[] = Array.isArray(body['body']) ? body['body'] : [];
    for (const raw of stmts) {
      const stmt = asAstNode(raw);
      if (stmt?.type === 'ReturnStatement') {
        const arg = asAstNode(stmt['argument']);
        if (arg?.type === 'JSXElement') return arg;
      }
    }
  }
  return undefined;
}

function findExportStyleAndJsx(ast: AstNode): { style: ExportStyle; jsx?: AstNode | undefined } {
  const program = asAstNode(ast['program']);
  const body: unknown[] = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type === 'ExportDefaultDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'FunctionDeclaration') {
        return { style: 'defaultFunc', jsx: findReturnedJsx(decl) };
      }
      if (decl?.type === 'Identifier') {
        const varName = decl['name'] as string;
        for (const raw2 of body) {
          const stmt2 = asAstNode(raw2);
          if (stmt2?.type === 'VariableDeclaration') {
            const decls: unknown[] = Array.isArray(stmt2['declarations'])
              ? stmt2['declarations']
              : [];
            for (const d of decls) {
              const varDecl = asAstNode(d);
              if (asAstNode(varDecl?.['id'])?.['name'] === varName) {
                const init = asAstNode(varDecl?.['init']);
                if (
                  init?.type === 'ArrowFunctionExpression' ||
                  init?.type === 'FunctionExpression'
                ) {
                  return { style: 'arrowDefault', jsx: findReturnedJsx(init) };
                }
              }
            }
          }
        }
      }
    } else if (stmt?.type === 'ExportNamedDeclaration') {
      const decl = asAstNode(stmt['declaration']);
      if (decl?.type === 'FunctionDeclaration') {
        return { style: 'namedFunc', jsx: findReturnedJsx(decl) };
      }
    }
  }
  return { style: 'namedFunc' };
}

type LayoutImportInfo = {
  readonly resolvedFile: string;
  readonly isNamedImport: boolean;
  readonly importHasExt: boolean;
};

async function findImportForTag(
  fs: FileSystemPort,
  root: string,
  sampleFile: string,
  ast: AstNode,
  tagName: string,
): Promise<LayoutImportInfo | undefined> {
  const program = asAstNode(ast['program']);
  const body: unknown[] = Array.isArray(program?.['body']) ? program['body'] : [];

  for (const item of body) {
    const stmt = asAstNode(item);
    if (stmt?.type !== 'ImportDeclaration') continue;
    const specifiers: unknown[] = Array.isArray(stmt['specifiers']) ? stmt['specifiers'] : [];
    for (const raw of specifiers) {
      const spec = asAstNode(raw);
      const local = asAstNode(spec?.['local']);
      if (local?.['name'] === tagName) {
        const sourceVal = asAstNode(stmt['source'])?.['value'];
        if (
          typeof sourceVal === 'string' &&
          (sourceVal.startsWith('.') || sourceVal.startsWith('@/'))
        ) {
          const resolved = await resolveImportPath(fs, root, sampleFile, sourceVal, 'src');
          if (resolved) {
            return {
              resolvedFile: resolved,
              isNamedImport: spec?.type === 'ImportSpecifier',
              importHasExt: /\.(tsx|jsx|ts|js)$/.test(sourceVal),
            };
          }
        }
      }
    }
  }
  return undefined;
}

function extractJsxClassName(element: AstNode): string | undefined {
  const opening = asAstNode(element['openingElement']);
  const attrs: unknown[] = Array.isArray(opening?.['attributes']) ? opening['attributes'] : [];
  for (const raw of attrs) {
    const attr = asAstNode(raw);
    const name = asAstNode(attr?.['name']);
    if (attr?.type === 'JSXAttribute' && name?.['name'] === 'className') {
      const val = asAstNode(attr['value']);
      if (val?.type === 'StringLiteral' && typeof val['value'] === 'string') return val['value'];
      if (val?.type === 'JSXExpressionContainer') {
        const expr = asAstNode(val['expression']);
        if (expr?.type === 'StringLiteral' && typeof expr['value'] === 'string')
          return expr['value'];
      }
    }
  }
  return undefined;
}

async function inspectSampleFile(
  fs: FileSystemPort,
  root: string,
  file: string,
): Promise<SampleInfo | undefined> {
  const read = await fs.readText(root, file);
  if (!read.ok) return undefined;
  let ast: AstNode;
  try {
    ast = parseJsxAst(read.value);
  } catch {
    return undefined;
  }

  const ext = file.endsWith('.jsx') ? 'jsx' : 'tsx';
  const { style, jsx } = findExportStyleAndJsx(ast);
  if (!jsx) return { file, ext, exportStyle: style, rootTag: 'main' };

  const topTag = jsxName(jsx);
  let layout: SampleInfo['layout'];
  let rootElem = jsx;

  if (topTag && /^[A-Z]/.test(topTag)) {
    const layoutImport = await findImportForTag(fs, root, file, ast, topTag);
    if (layoutImport) {
      layout = { name: topTag, ...layoutImport };
      const children: unknown[] = Array.isArray(jsx['children']) ? jsx['children'] : [];
      for (const raw of children) {
        const child = asAstNode(raw);
        if (child?.type === 'JSXElement') {
          rootElem = child;
          break;
        }
      }
    }
  }

  const rootTag = jsxName(rootElem) ?? 'main';
  const rootClassName = extractJsxClassName(rootElem);
  return { file, ext, exportStyle: style, layout, rootTag, rootClassName };
}

async function collectSampleFiles(
  fs: FileSystemPort,
  root: string,
  dir: string,
  firstPagesDir?: string,
): Promise<SampleInfo[]> {
  const candidateDirs = [dir];
  if (firstPagesDir && firstPagesDir !== dir) candidateDirs.push(firstPagesDir);

  for (const targetDir of candidateDirs) {
    const entries = await fs.readDir(root, targetDir);
    if (!entries.ok) continue;
    const files = entries.value
      .filter((e) => e.kind === 'file' && /\.(jsx|tsx)$/.test(e.name))
      .map((e) => `${targetDir}/${e.name}`)
      .sort()
      .slice(0, MAX_SAMPLE_FILES);

    if (files.length === 0) continue;
    const samples: SampleInfo[] = [];
    for (const f of files) {
      const info = await inspectSampleFile(fs, root, f);
      if (info) samples.push(info);
    }
    if (samples.length > 0) return samples;
  }
  return [];
}

export async function resolvePageTemplateExtension(
  input: ResolvePageExtInput,
): Promise<'jsx' | 'tsx'> {
  const samples = await collectSampleFiles(input.fs, input.root, input.dir, input.firstPagesDir);
  if (samples.length === 0) return input.language === 'ts' ? 'tsx' : 'jsx';
  const jsxCount = samples.filter((s) => s.ext === 'jsx').length;
  const tsxCount = samples.filter((s) => s.ext === 'tsx').length;
  if (jsxCount > tsxCount) return 'jsx';
  return input.language === 'ts' ? 'tsx' : 'jsx';
}

function computeMajorityLayout(
  samples: SampleInfo[],
  targetDir: string,
): { name: string; importStatement: string } | undefined {
  const layouts = samples
    .map((s) => s.layout)
    .filter((l): l is NonNullable<SampleInfo['layout']> => l !== undefined);
  if (layouts.length === 0 || layouts.length < samples.length / 2) return undefined;

  const layoutNames = new Map<string, number>();
  for (const l of layouts) {
    layoutNames.set(l.name, (layoutNames.get(l.name) ?? 0) + 1);
  }
  let bestName: string | undefined;
  let bestCount = 0;
  for (const [name, count] of layoutNames.entries()) {
    if (count > bestCount) {
      bestName = name;
      bestCount = count;
    }
  }
  if (!bestName || bestCount < samples.length / 2) return undefined;

  const chosen = layouts.find((l) => l.name === bestName);
  if (!chosen) return undefined;

  let relPath = path.posix.relative(targetDir, chosen.resolvedFile);
  if (!relPath.startsWith('.')) relPath = `./${relPath}`;
  if (!chosen.importHasExt) {
    relPath = relPath.replace(/\.(tsx|jsx|ts|js)$/, '');
  }

  const importStatement = chosen.isNamedImport
    ? `import { ${chosen.name} } from '${relPath}';\n\n`
    : `import ${chosen.name} from '${relPath}';\n\n`;

  return { name: chosen.name, importStatement };
}

function computeMajorityStyle(samples: SampleInfo[]): ExportStyle {
  let defaultCount = 0;
  let arrowCount = 0;
  let namedCount = 0;
  for (const s of samples) {
    if (s.exportStyle === 'defaultFunc') defaultCount++;
    else if (s.exportStyle === 'arrowDefault') arrowCount++;
    else namedCount++;
  }
  if (defaultCount > arrowCount && defaultCount > namedCount) return 'defaultFunc';
  if (arrowCount > defaultCount && arrowCount > namedCount) return 'arrowDefault';
  return 'namedFunc';
}

function computeMajorityRoot(samples: SampleInfo[]): {
  rootTag: string;
  rootClassName?: string | undefined;
} {
  const tagCounts = new Map<string, number>();
  const classCounts = new Map<string, number>();

  for (const s of samples) {
    tagCounts.set(s.rootTag, (tagCounts.get(s.rootTag) ?? 0) + 1);
    if (s.rootClassName) {
      classCounts.set(s.rootClassName, (classCounts.get(s.rootClassName) ?? 0) + 1);
    }
  }

  let rootTag = 'main';
  for (const [tag, count] of tagCounts.entries()) {
    if (count > samples.length / 2) rootTag = tag;
  }

  let rootClassName: string | undefined;
  for (const [cls, count] of classCounts.entries()) {
    if (count > samples.length / 2) rootClassName = cls;
  }

  return { rootTag, rootClassName };
}

export type BuiltPageSource = {
  readonly code: string;
  readonly isDefaultExport: boolean;
};

function renderPageCode(
  component: string,
  name: string,
  style: ExportStyle,
  layout: { name: string; importStatement: string } | undefined,
  rootTag: string,
  rootClassName?: string,
): string {
  const classAttr = rootClassName ? ` className="${rootClassName}"` : '';
  const inner = `<h1>${escapeJsxText(name)}</h1>`;
  const body = layout
    ? `    <${layout.name}>\n      <${rootTag}${classAttr}>\n        ${inner}\n      </${rootTag}>\n    </${layout.name}>`
    : `    <${rootTag}${classAttr}>\n      ${inner}\n    </${rootTag}>`;

  const importLine = layout?.importStatement ?? '';
  if (style === 'defaultFunc') {
    return `${importLine}export default function ${component}() {\n  return (\n${body}\n  );\n}\n`;
  }
  if (style === 'arrowDefault') {
    return `${importLine}const ${component} = () => {\n  return (\n${body}\n  );\n};\n\nexport default ${component};\n`;
  }
  return `${importLine}export function ${component}() {\n  return (\n${body}\n  );\n}\n`;
}

function defaultFallbackSource(component: string, name: string, isTailwind: boolean): string {
  const cls = isTailwind ? ' className="mx-auto max-w-5xl p-8"' : '';
  const h1Cls = isTailwind ? ' className="text-3xl font-bold"' : '';
  const content = `    <main${cls}>\n      <h1${h1Cls}>${escapeJsxText(name)}</h1>\n    </main>`;
  return `export function ${component}() {\n  return (\n${content}\n  );\n}\n`;
}

export async function buildPageSource(input: BuildPageSourceInput): Promise<BuiltPageSource> {
  const samples = await collectSampleFiles(input.fs, input.root, input.dir, input.firstPagesDir);
  if (samples.length === 0) {
    const sys = primarySystem(input.styling);
    const code = defaultFallbackSource(
      input.component,
      input.name,
      sys === 'tailwind4' || sys === 'tailwind3',
    );
    return { code, isDefaultExport: false };
  }

  const layout = computeMajorityLayout(samples, input.dir);
  const style = computeMajorityStyle(samples);
  const { rootTag, rootClassName } = computeMajorityRoot(samples);
  const code = renderPageCode(input.component, input.name, style, layout, rootTag, rootClassName);
  return { code, isDefaultExport: style === 'defaultFunc' || style === 'arrowDefault' };
}
