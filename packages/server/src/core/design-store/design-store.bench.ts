// PB-02 (SPEC-01.1 section 11.2, ≤ 20 ms): receive, validate and apply one batch on the server.
// PB-03 (≤ 50 ms): save an edit of a 500-node page (serialize, back up, atomic write).
// `pnpm bench` prints the timings; the budgets are checked by the nightly job (G1-03).
import {
  type DesignDocument,
  type DesignNode,
  documentToFiles,
  OperationBatchSchema,
} from '@reactcraft/model';
import { afterAll, expect, test } from 'vitest';

import type { FileSystemPort } from '../ports/file-system-port.ts';
import { ok } from '../shared/result.ts';
import {
  createWorkspaceDocument,
  CreateWorkspaceRequestSchema,
} from '../workspace/create-workspace.ts';
import { makeTempDir, nodeFs, sequenceIds, silentLogger } from '../workspace/test-support.ts';
import { createDesignStore } from './design-store.ts';

let counter = 0;
const id = () => `n_bench${String(++counter).padStart(5, '0')}`;
const text = (value: string): DesignNode => ({
  id: id(),
  type: 'Text',
  content: { kind: 'text', text: value },
});

/** Section > Grid > 30 cards of 3 nodes: 122 nodes; four of them plus fillers make 500. */
function section(): DesignNode {
  const cards = Array.from({ length: 30 }, (): DesignNode => ({
    id: id(),
    type: 'Card',
    content: { kind: 'none' },
    style: { gap: 'token:spacing.2', padding: { top: 'token:spacing.4' } },
    children: [
      { id: id(), type: 'Heading', content: { kind: 'heading', text: 'Title', level: 3 } },
      text('Body'),
    ],
  }));
  const grid: DesignNode = { id: id(), type: 'Grid', content: { kind: 'none' }, children: cards };
  return { id: id(), type: 'Section', content: { kind: 'section' }, children: [grid] };
}

function largeDocument(): { document: DesignDocument; pageId: string; nodeId: string } {
  const base = createWorkspaceDocument(CreateWorkspaceRequestSchema.parse({ name: 'Bench' }), {
    newId: sequenceIds(),
    now: new Date(),
  });
  const pageId = base.workspace.pageOrder[0] ?? '';
  const page = base.pages[pageId];
  if (page === undefined) throw new Error('no page');
  counter = 1; // the root
  const children: DesignNode[] = [];
  while (counter + 122 <= 500) children.push(section());
  while (counter < 500) children.push(text('Filler'));
  const nodeId = children[0]?.children?.[0]?.children?.[10]?.id ?? '';
  return {
    document: { ...base, pages: { [pageId]: { ...page, root: { ...page.root, children } } } },
    pageId,
    nodeId,
  };
}

const { document, pageId, nodeId } = largeDocument();
let gap = 0;
/** The JSON body the Studio sends: a style change on a card. */
const body = (baseRevision: number) =>
  JSON.stringify({
    baseRevision,
    meta: { source: 'user', label: 'Gap' },
    ops: [
      {
        op: 'setStyle',
        target: { kind: 'page', pageId },
        nodeId,
        scope: {},
        set: { gap: { px: (gap = (gap + 1) % 100) } },
      },
    ],
  });

const okAsync = <T>(value: T) => Promise.resolve(ok(value));
/** PB-02 leaves the disk out: saving is PB-03. */
const nullFs: FileSystemPort = {
  readText: () => okAsync(''),
  writeTextAtomic: () => okAsync(undefined),
  createExclusive: () => okAsync('created' as const),
  readDir: () => okAsync([]),
  exists: () => Promise.resolve(false),
  remove: () => okAsync(undefined),
  copy: () => okAsync(undefined),
  rename: () => okAsync(undefined),
};
const system = {
  pid: 1,
  hostname: 'bench',
  now: () => new Date(),
  isProcessAlive: () => true,
  isListening: () => Promise.resolve(true),
};
const temp = await makeTempDir();

afterAll(async () => {
  await temp.cleanup();
});

test('PB-02: parse, validate and apply one batch on a 500-node page', async ({ bench }) => {
  expect(counter).toBe(500);
  const store = createDesignStore({
    fs: nullFs,
    root: temp.dir,
    system,
    logger: silentLogger,
    initialDocument: document,
    initialRevision: 0,
  });

  const result = await bench('receive batch', async () => {
    const batch = OperationBatchSchema.parse(JSON.parse(body(store.revision())));
    const applied = await store.applyBatch(batch);
    if (!applied.ok) throw new Error(applied.error.code);
  }).run();
  await store.close();

  expect(result.name).toBe('receive batch');
});

test('PB-03: save an edit of a 500-node page', async ({ bench }) => {
  for (const [file, content] of Object.entries(documentToFiles(document))) {
    await nodeFs.writeTextAtomic(temp.dir, file, content);
  }
  const store = createDesignStore({
    fs: nodeFs,
    root: temp.dir,
    system,
    logger: silentLogger,
    initialDocument: document,
    initialRevision: 0,
  });

  // Each run applies one edit first (PB-02, about 1 ms) so there is something to save.
  const result = await bench('save page edit', async () => {
    await store.applyBatch(OperationBatchSchema.parse(JSON.parse(body(store.revision()))));
    const flushed = await store.flush();
    if (!flushed.ok) throw new Error(flushed.error.code);
  }).run();

  expect(result.name).toBe('save page edit');
});
