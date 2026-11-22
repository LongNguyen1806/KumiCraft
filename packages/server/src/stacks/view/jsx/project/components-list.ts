// List of components and layouts for Studio component panel (SPEC-04 M-CP, R-CP-11..13).
import * as path from 'node:path';

import type { ProjectComponent, ProjectInfo } from '@kumicraft/shared';

import type { ComponentsListDeps } from '../../../../kernel/features.ts';
import type { FileSystemPort } from '../../../../ports/file-system-port.ts';
import { createUsageCounter, readAliasPrefix, summarize } from '../component-usages.ts';
import { insertJsxFor } from './component-insert-jsx.ts';

async function collectFiles(
  fs: FileSystemPort,
  root: string,
  dir: string,
  out: string[],
): Promise<void> {
  const entries = await fs.readDir(root, dir);
  if (!entries.ok) return;
  for (const entry of entries.value) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.kind === 'directory') {
      await collectFiles(fs, root, path, out);
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      if (entry.name.includes('.test.') || entry.name.includes('.stories.')) continue;
      out.push(path);
    }
  }
}

async function readConfigComponents(fs: FileSystemPort, root: string): Promise<readonly string[]> {
  const read = await fs.readText(root, '.kumicraft/components.json');
  if (!read.ok) return [];
  try {
    const parsed = JSON.parse(read.value) as { readonly files?: readonly unknown[] };
    if (!Array.isArray(parsed.files)) return [];
    const valid: string[] = [];
    for (const item of parsed.files) {
      if (typeof item === 'string' && /\.(tsx|jsx)$/.test(item)) {
        const exists = await fs.exists(root, item);
        if (exists) valid.push(item);
      }
    }
    return valid;
  } catch {
    return [];
  }
}

export function buildImportSource(
  file: string,
  aliasPrefix: string | undefined,
  fromFile?: string,
): string {
  if (aliasPrefix && file.startsWith(aliasPrefix)) {
    const after = file.slice(aliasPrefix.length);
    const withoutExt = after.replace(/\.(tsx|jsx)$/, '');
    const clean = withoutExt.endsWith('/index')
      ? withoutExt.slice(0, -'/index'.length)
      : withoutExt;
    return `@/${clean}`;
  }
  if (fromFile !== undefined) {
    const fromDir = path.posix.dirname(fromFile);
    const rel = path.posix.relative(fromDir, file);
    const withoutExt = rel.replace(/\.(tsx|jsx)$/, '');
    const clean = withoutExt.endsWith('/index')
      ? withoutExt.slice(0, -'/index'.length)
      : withoutExt;
    return clean.startsWith('.') ? clean : `./${clean}`;
  }
  const parts = file.split('/');
  const fileName = parts[parts.length - 1] ?? file;
  const nameWithoutExt = fileName.replace(/\.(tsx|jsx)$/, '');
  return `./${nameWithoutExt}`;
}

type ComponentScanTarget = {
  readonly file: string;
  readonly kind: 'component' | 'layout';
};

type DirRule = {
  readonly dir: string;
  readonly kind: 'layout' | 'component';
};

function buildSortedDirRules(info: ProjectInfo): DirRule[] {
  const rules: DirRule[] = [];
  for (const d of info.designDirs.layouts) rules.push({ dir: d, kind: 'layout' });
  for (const d of info.designDirs.components) rules.push({ dir: d, kind: 'component' });
  return rules.sort((a, b) => b.dir.length - a.dir.length);
}

async function collectAllTargets(
  fs: FileSystemPort,
  root: string,
  info: ProjectInfo,
): Promise<ComponentScanTarget[]> {
  const targets: ComponentScanTarget[] = [];
  const seenFiles = new Set<string>();
  const rules = buildSortedDirRules(info);

  for (const rule of rules) {
    const files: string[] = [];
    await collectFiles(fs, root, rule.dir, files);
    for (const f of files) {
      if (seenFiles.has(f)) continue;
      seenFiles.add(f);
      // Longest matching rule determines kind
      const matched = rules.find((r) => f.startsWith(`${r.dir}/`));
      targets.push({ file: f, kind: matched?.kind ?? rule.kind });
    }
  }

  const configFiles = await readConfigComponents(fs, root);
  for (const f of configFiles) {
    if (!seenFiles.has(f)) {
      seenFiles.add(f);
      targets.push({ file: f, kind: 'component' });
    }
  }

  return targets;
}

function extractExportedComponents(
  code: string,
  file: string,
  kind: 'component' | 'layout',
  aliasPrefix: string | undefined,
): readonly { name: string; kind: 'component' | 'layout'; importStatement: string }[] {
  const summary = summarize(code);
  if (!summary) return [];

  const results: { name: string; kind: 'component' | 'layout'; importStatement: string }[] = [];
  const importSource = buildImportSource(file, aliasPrefix);

  // A capitalised name is a component only when this file makes it one (a function, a class, memo,
  // forwardRef…); a name declared elsewhere (`export { Button } from './button'`) cannot be checked
  // here and is kept (spec-log #121).
  const { declared, components } = summary.kinds;
  const isComponent = (name: string) =>
    /^[A-Z]/.test(name) && (components.has(name) || !declared.has(name));

  for (const name of summary.exported) {
    if (isComponent(name)) {
      results.push({
        name,
        kind,
        importStatement: `import { ${name} } from '${importSource}';`,
      });
    }
  }

  const defaultLocal = summary.defaultLocal;
  if (defaultLocal && isComponent(defaultLocal) && !summary.exported.has(defaultLocal)) {
    results.push({
      name: defaultLocal,
      kind,
      importStatement: `import ${defaultLocal} from '${importSource}';`,
    });
  }

  return results;
}

function withInsertJsx(jsx: string | undefined): { insertJsx?: string } {
  return jsx === undefined ? {} : { insertJsx: jsx };
}

export async function listProjectComponents(
  deps: ComponentsListDeps,
  root: string,
  info: ProjectInfo,
): Promise<ProjectComponent[]> {
  const targets = await collectAllTargets(deps.fs, root, info);
  const aliasPrefix = await readAliasPrefix(deps.fs, root);
  // One read of each file for the whole list, not one per component (spec-log #117).
  const counter = (deps.usageCounter ?? createUsageCounter(deps.fs)).batch();
  const { sourceDir } = info;

  const components: ProjectComponent[] = [];

  for (const target of targets) {
    const read = await deps.fs.readText(root, target.file, { maxBytes: 1024 * 1024 });
    if (!read.ok) continue;

    const exported = extractExportedComponents(read.value, target.file, target.kind, aliasPrefix);
    for (const item of exported) {
      const usages = await counter.count(root, sourceDir, target.file, item.name);
      components.push({
        name: item.name,
        file: target.file,
        kind: item.kind,
        usages,
        importStatement: item.importStatement,
        ...withInsertJsx(insertJsxFor(read.value, item.name)),
      });
    }
  }

  components.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'layout' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return components;
}

export type { ComponentsListDeps };
