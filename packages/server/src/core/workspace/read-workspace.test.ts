import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  type DesignDocument,
  documentToFiles,
  SCHEMA_VERSION,
  workspaceFilePath,
  type WorkspaceFiles,
} from '@reactcraft/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createWorkspaceDocument, CreateWorkspaceRequestSchema } from './create-workspace.ts';
import { loadWorkspace } from './read-workspace.ts';
import { makeTempDir, nodeFs, NOW, sequenceIds } from './test-support.ts';

let dir: string;
let cleanup: () => Promise<void>;
let document: DesignDocument;

const write = async (file: string, text: string) => {
  await mkdir(dirname(join(dir, file)), { recursive: true });
  await writeFile(join(dir, file), text);
};

const writeDocument = async (files: Record<string, string>) => {
  for (const [file, text] of Object.entries(files)) await write(file, text);
};

const pageId = () => document.workspace.pageOrder[0] ?? '';

beforeEach(async () => {
  ({ dir, cleanup } = await makeTempDir());
  document = createWorkspaceDocument(CreateWorkspaceRequestSchema.parse({ name: 'Shop' }), {
    newId: sequenceIds(),
    now: NOW,
  });
});

afterEach(async () => {
  await cleanup();
});

describe('loadWorkspace', () => {
  it('opens the document written by documentToFiles', async () => {
    await writeDocument(documentToFiles(document));

    expect(await loadWorkspace(nodeFs, dir, NOW)).toEqual({
      status: 'open',
      document,
      warnings: [],
    });
  });

  it('puts the whole workspace in error when one page file is broken [R-WS-01]', async () => {
    await writeDocument(documentToFiles(document));
    await write(workspaceFilePath.page(pageId()), '{ "id": ');

    expect(await loadWorkspace(nodeFs, dir, NOW)).toEqual({
      status: 'error',
      problems: [
        {
          file: workspaceFilePath.page(pageId()),
          error: expect.objectContaining({ code: 'E004' }) as unknown,
        },
      ],
    });
  });

  it('lists every missing file [R-WS-02]', async () => {
    await write(workspaceFilePath.workspace(), '{}');

    const loaded = await loadWorkspace(nodeFs, dir, NOW);

    expect(
      loaded.status === 'error' && loaded.problems.map((problem) => problem.error.code),
    ).toEqual(['E015', 'E015']);
  });

  it('rejects JSON nested deeper than the limit before parsing it', async () => {
    await writeDocument(documentToFiles(document));
    await write(workspaceFilePath.tokens(), `${'['.repeat(100)}${']'.repeat(100)}`);

    expect(await loadWorkspace(nodeFs, dir, NOW)).toMatchObject({
      status: 'error',
      problems: [{ error: { code: 'E004', params: { reason: 'tooDeep' } } }],
    });
  });

  it('asks for a newer ReactCraft when the workspace is newer', async () => {
    const files = documentToFiles(document);
    const meta = JSON.parse(files[workspaceFilePath.workspace()] ?? '') as object;
    await writeDocument({
      ...files,
      [workspaceFilePath.workspace()]: JSON.stringify({
        ...meta,
        schemaVersion: SCHEMA_VERSION + 1,
      }),
    });

    expect(await loadWorkspace(nodeFs, dir, NOW)).toMatchObject({
      status: 'error',
      problems: [{ error: { code: 'E004', params: { schemaVersion: SCHEMA_VERSION + 1 } } }],
    });
  });

  it('reports a rule broken in a page against that page file', async () => {
    const page = document.pages[pageId()];
    const broken = { ...page, root: { ...page?.root, style: { direction: 'row' } } };
    await writeDocument({
      ...documentToFiles(document),
      [workspaceFilePath.page(pageId())]: JSON.stringify(broken),
    });

    expect(await loadWorkspace(nodeFs, dir, NOW)).toMatchObject({
      status: 'error',
      problems: [{ file: workspaceFilePath.page(pageId()), error: { code: 'E004' } }],
    });
  });

  it('appends a page missing from pageOrder, with a warning', async () => {
    const files = documentToFiles({
      ...document,
      workspace: { ...document.workspace, pageOrder: [] },
    });
    await writeDocument(files);

    expect(await loadWorkspace(nodeFs, dir, NOW)).toMatchObject({
      status: 'open',
      document: { workspace: { pageOrder: [pageId()] } },
      warnings: [expect.stringContaining(pageId()) as unknown],
    });
  });

  it('backs up the old files, then writes the migrated ones', async () => {
    const files = documentToFiles(document);
    const old = Object.fromEntries(
      Object.entries(files).map(([file, text]) => [
        file,
        file.endsWith('.json')
          ? text.replace(`"schemaVersion": ${String(SCHEMA_VERSION)}`, '"schemaVersion": 0')
          : text,
      ]),
    );
    await writeDocument(old);
    const migrations = [{ from: 0, to: 1, migrate: (files: WorkspaceFiles) => files }];

    expect(await loadWorkspace(nodeFs, dir, NOW, migrations)).toMatchObject({
      status: 'open',
      migratedFrom: 0,
    });
    const backup = join(dir, '.reactcraft/backups/migration-20261011-080910-123');
    expect((await readdir(backup)).sort()).toEqual([
      'data-sources.json',
      'pages',
      'tokens.json',
      'workspace.json',
    ]);
    expect(await readFile(join(backup, 'workspace.json'), 'utf8')).toContain('"schemaVersion": 0');
    expect(await readFile(join(dir, workspaceFilePath.workspace()), 'utf8')).toBe(
      files[workspaceFilePath.workspace()],
    );
  });
});
