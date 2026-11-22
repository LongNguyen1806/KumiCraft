// Unified Data Source discovery & field extraction service (TypeScript, Zod, Django, OpenAPI JSON).
import * as posixPath from 'node:path/posix';

import type {
  DataField,
  DataSourceFieldsRequest,
  DataSourceFieldsResponse,
  DataSourceItem,
  DataSourceListResponse,
  Result,
} from '@kumicraft/shared';
import { err, ok } from '@kumicraft/shared';

import type { FileSystemPort } from '../../ports/file-system-port.ts';
import type { ProcessPort } from '../../ports/process-port.ts';
import { listDjangoSourcesInFile, readDjangoFieldsFromFile } from './django-reader.ts';
import { listOpenApiSourcesInFile, readOpenApiFieldsFromFile } from './openapi-reader.ts';
import { listTypeScriptSources, readTypeScriptFields } from './ts-source-reader.ts';
import { listZodSourcesInFile, readZodFieldsFromFile } from './zod-reader.ts';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.kumicraft',
  '.next',
  'venv',
  '.venv',
  '__pycache__',
  'coverage',
]);
const MAX_WALK_DEPTH = 6;
const MAX_READ_BYTES = 512_000;

type ScannedFiles = {
  readonly tsFiles: readonly string[];
  readonly zodFiles: readonly string[];
  readonly djangoFiles: readonly string[];
  readonly openApiJsonFiles: readonly string[];
  readonly yamlFiles: readonly string[];
};

function isTestOrGenerated(name: string, rel: string): boolean {
  if (name.includes('.test.') || name.includes('.spec.') || name.endsWith('.d.ts')) return true;
  if (rel.includes('/kumicraft/') || name.endsWith('.data.ts') || name.endsWith('.data.js')) {
    return true;
  }
  return false;
}

async function scanWorkspaceFiles(fs: FileSystemPort, root: string): Promise<ScannedFiles> {
  const tsFiles: string[] = [];
  const zodFiles: string[] = [];
  const djangoFiles: string[] = [];
  const openApiJsonFiles: string[] = [];
  const yamlFiles: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_WALK_DEPTH) return;
    const entriesRes = await fs.readDir(root, dir);
    if (!entriesRes.ok) return;
    for (const entry of entriesRes.value) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const rel = dir.length > 0 ? posixPath.join(dir, entry.name) : entry.name;
      if (entry.kind === 'directory') {
        await walk(rel, depth + 1);
        continue;
      }
      if (entry.name === 'models.py') {
        djangoFiles.push(rel);
      } else if (/\.(ya?ml)$/i.test(entry.name) && /(openapi|swagger)/i.test(entry.name)) {
        yamlFiles.push(rel);
      } else if (entry.name.endsWith('.json') && /(openapi|swagger|schema)/i.test(entry.name)) {
        openApiJsonFiles.push(rel);
      } else if (!isTestOrGenerated(entry.name, rel)) {
        if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && rel.startsWith('src/')) {
          tsFiles.push(rel);
        }
        if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          zodFiles.push(rel);
        }
      }
    }
  }

  await walk('', 0);
  return { tsFiles, zodFiles, djangoFiles, openApiJsonFiles, yamlFiles };
}

async function collectBackendDjangoFiles(
  fs: FileSystemPort,
  backendRoots: readonly string[],
): Promise<readonly { readonly absRoot: string; readonly rel: string }[]> {
  const found: { absRoot: string; rel: string }[] = [];
  for (const absRoot of backendRoots) {
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > MAX_WALK_DEPTH) return;
      const res = await fs.readDir(absRoot, dir);
      if (!res.ok) return;
      for (const entry of res.value) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const rel = dir.length > 0 ? posixPath.join(dir, entry.name) : entry.name;
        if (entry.kind === 'directory') await walk(rel, depth + 1);
        else if (entry.name === 'models.py') found.push({ absRoot, rel });
      }
    };
    await walk('', 0);
  }
  return found;
}

export type DataSourcesServiceDeps = {
  readonly fs: FileSystemPort;
  readonly process?: ProcessPort | undefined;
  readonly tsInspectScript?: string | undefined;
};

export async function listProjectDataSources(
  deps: DataSourcesServiceDeps,
  projectRoot: string,
  backendRoots: readonly string[] = [],
): Promise<DataSourceListResponse> {
  const scanned = await scanWorkspaceFiles(deps.fs, projectRoot);
  const sources: DataSourceItem[] = [];

  const tsSources = await listTypeScriptSources(
    { fs: deps.fs, process: deps.process, scriptPath: deps.tsInspectScript },
    projectRoot,
    scanned.tsFiles,
  );
  sources.push(...tsSources);

  for (const file of scanned.zodFiles) {
    const read = await deps.fs.readText(projectRoot, file, { maxBytes: MAX_READ_BYTES });
    if (read.ok) sources.push(...listZodSourcesInFile(file, read.value));
  }

  for (const file of scanned.djangoFiles) {
    const read = await deps.fs.readText(projectRoot, file, { maxBytes: MAX_READ_BYTES });
    if (read.ok) sources.push(...listDjangoSourcesInFile(file, read.value));
  }

  const seenModels = new Set(scanned.djangoFiles);
  for (const b of await collectBackendDjangoFiles(deps.fs, backendRoots)) {
    if (seenModels.has(b.rel)) continue;
    const read = await deps.fs.readText(b.absRoot, b.rel, { maxBytes: MAX_READ_BYTES });
    if (read.ok) sources.push(...listDjangoSourcesInFile(b.rel, read.value));
  }

  for (const file of scanned.openApiJsonFiles) {
    const read = await deps.fs.readText(projectRoot, file, { maxBytes: MAX_READ_BYTES });
    if (read.ok) sources.push(...listOpenApiSourcesInFile(file, read.value));
  }

  return {
    sources,
    ...(scanned.yamlFiles.length > 0 ? { yamlUnsupportedFiles: scanned.yamlFiles } : {}),
  };
}

async function readBackendDjangoText(
  fs: FileSystemPort,
  backendRoots: readonly string[],
  rel: string,
): Promise<string | undefined> {
  for (const root of backendRoots) {
    const read = await fs.readText(root, rel, { maxBytes: MAX_READ_BYTES });
    if (read.ok) return read.value;
  }
  return undefined;
}

export async function readProjectDataSourceFields(
  deps: DataSourcesServiceDeps,
  projectRoot: string,
  request: DataSourceFieldsRequest,
  backendRoots: readonly string[] = [],
): Promise<Result<DataSourceFieldsResponse>> {
  let fields: readonly DataField[];
  if (request.kind === 'typescript') {
    fields = await readTypeScriptFields(
      { fs: deps.fs, process: deps.process, scriptPath: deps.tsInspectScript },
      projectRoot,
      request.file,
      request.name,
    );
  } else {
    const read = await deps.fs.readText(projectRoot, request.file, { maxBytes: MAX_READ_BYTES });
    const text = read.ok
      ? read.value
      : request.kind === 'django'
        ? await readBackendDjangoText(deps.fs, backendRoots, request.file)
        : undefined;
    if (text === undefined) {
      return err({ code: 'E015', params: { path: request.file } });
    }
    if (request.kind === 'zod') fields = readZodFieldsFromFile(text, request.name);
    else if (request.kind === 'django') fields = readDjangoFieldsFromFile(text, request.name);
    else fields = readOpenApiFieldsFromFile(text, request.name);
  }

  const labelSuffix =
    request.kind === 'typescript'
      ? 'TypeScript'
      : request.kind === 'zod'
        ? 'Zod'
        : request.kind === 'django'
          ? 'Django'
          : 'OpenAPI';

  return ok({
    source: {
      id: `${request.kind}:${request.file}:${request.name}`,
      kind: request.kind,
      name: request.name,
      file: request.file,
      label: `${request.name} (${labelSuffix})`,
    },
    fields,
  });
}
