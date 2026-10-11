import { describe, expect, it } from 'vitest';

import allNodes from '../../../../fixtures/designs/all-nodes.json' with { type: 'json' };
import type { DesignDocument } from '../schema/document.schema.ts';
import { checkDocument } from '../schema/validate/validate-document.ts';
import type { WorkspaceFiles } from './migrate.ts';
import { assembleDocument, documentToFiles, WORKSPACE_GITIGNORE } from './workspace-files.ts';

const document = allNodes as unknown as DesignDocument;

/** What the server would read back: every JSON file parsed, grouped by kind. */
function readBack(files: Record<string, string>): WorkspaceFiles {
  const json = (path: string) => JSON.parse(files[path] ?? 'null') as unknown;
  const group = (folder: string) =>
    Object.fromEntries(
      Object.keys(files)
        .filter((path) => path.startsWith(`.reactcraft/${folder}/`))
        .map((path) => [path.slice(`.reactcraft/${folder}/`.length, -'.json'.length), json(path)]),
    );
  return {
    workspace: json('.reactcraft/workspace.json'),
    tokens: json('.reactcraft/tokens.json'),
    dataSources: json('.reactcraft/data-sources.json'),
    pages: group('pages'),
    components: group('components'),
  };
}

describe('documentToFiles', () => {
  it('writes one canonical file per part of the document, plus .gitignore', () => {
    const files = documentToFiles(document);

    expect(Object.keys(files).sort()).toEqual([
      '.reactcraft/.gitignore',
      '.reactcraft/components/c_card000001.json',
      '.reactcraft/data-sources.json',
      '.reactcraft/pages/p_form000001.json',
      '.reactcraft/pages/p_home000001.json',
      '.reactcraft/pages/p_prod000001.json',
      '.reactcraft/tokens.json',
      '.reactcraft/workspace.json',
    ]);
    expect(files['.reactcraft/.gitignore']).toBe(WORKSPACE_GITIGNORE);
  });

  it('is byte-identical when written twice, including after a read-back [R-DS-10]', () => {
    const first = documentToFiles(document);
    const assembled = assembleDocument(readBack(first)).document as DesignDocument;

    expect(documentToFiles(assembled)).toEqual(first);
  });
});

describe('assembleDocument', () => {
  it('rebuilds a document that passes every check', () => {
    const { document: assembled, warnings } = assembleDocument(readBack(documentToFiles(document)));

    expect(warnings).toEqual([]);
    expect(checkDocument(assembled).ok).toBe(true);
    expect(assembled).toEqual(document);
  });

  it('appends page files missing from pageOrder, with a warning', () => {
    const files = readBack(documentToFiles(document));
    const workspace = { ...(files.workspace as object), pageOrder: ['p_home000001'] };

    const { document: assembled, warnings } = assembleDocument({ ...files, workspace });

    expect((assembled as DesignDocument).workspace.pageOrder).toEqual([
      'p_home000001',
      'p_form000001',
      'p_prod000001',
    ]);
    expect(warnings).toHaveLength(2);
  });
});
