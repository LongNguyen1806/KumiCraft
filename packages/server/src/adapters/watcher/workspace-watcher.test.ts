import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type DesignDocument,
  documentToFiles,
  type OperationBatch,
  WORKSPACE_DIR,
  workspaceFilePath,
} from '@reactcraft/model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDesignStore, type DesignStore } from '../../core/design-store/design-store.ts';
import {
  createEventBus,
  type EventBusPort,
  type ServerEvent,
} from '../../core/ports/event-bus-port.ts';
import {
  createWorkspaceDocument,
  CreateWorkspaceRequestSchema,
} from '../../core/workspace/create-workspace.ts';
import {
  makeTempDir,
  nodeFs,
  sequenceIds,
  silentLogger,
} from '../../core/workspace/test-support.ts';
import { createWorkspaceWatcher, type WorkspaceWatcher } from './workspace-watcher.ts';

function sampleDoc(): DesignDocument {
  return createWorkspaceDocument(CreateWorkspaceRequestSchema.parse({ name: 'Watcher Test' }), {
    newId: sequenceIds(),
    now: new Date(1000),
  });
}

describe('WorkspaceWatcher', () => {
  let workspaceDir: string;
  let cleanupDir: () => Promise<void>;
  let eventBus: EventBusPort;
  let store: DesignStore;
  let watcher: WorkspaceWatcher;

  beforeEach(async () => {
    const temp = await makeTempDir();
    workspaceDir = temp.dir;
    cleanupDir = temp.cleanup;
    eventBus = createEventBus();

    const doc = sampleDoc();
    // Write initial workspace files to disk
    for (const [file, content] of Object.entries(documentToFiles(doc))) {
      await nodeFs.writeTextAtomic(workspaceDir, file, content);
    }

    let time = 1000;
    store = createDesignStore({
      fs: nodeFs,
      root: workspaceDir,
      system: {
        now: () => new Date((time += 1000)),
        pid: 1,
        hostname: 'host',
        isProcessAlive: () => true,
      },
      logger: silentLogger,
      initialDocument: doc,
      initialRevision: 1,
      eventBus,
    });

    watcher = createWorkspaceWatcher({
      root: workspaceDir,
      getStore: () => store,
      eventBus,
      logger: silentLogger,
    });
    await watcher.ready;
  });

  afterEach(async () => {
    await watcher.close();
    await store.close();
    await cleanupDir();
  });

  it('detects external file change, emits workspace.externalChange and marks R-DS-11', async () => {
    const receivedEvents: ServerEvent[] = [];
    eventBus.subscribe((evt) => {
      receivedEvents.push(evt);
    });

    expect(store.hasExternalChange()).toBe(false);

    // Simulate external change: direct writeFile to .reactcraft/tokens.json
    const tokenPath = join(workspaceDir, workspaceFilePath.tokens());
    await writeFile(tokenPath, '{"modified": true}', 'utf8');

    // Wait for chokidar debounce window (500ms + margin)
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(store.hasExternalChange()).toBe(true);

    const extChangeEvt = receivedEvents.find((e) => e.type === 'workspace.externalChange');
    expect(extChangeEvt).toBeDefined();
    if (extChangeEvt) {
      const payload = extChangeEvt.payload as { files: string[] };
      expect(payload.files).toContain(`${WORKSPACE_DIR}/tokens.json`);
    }

    // R-DS-11: applyBatch must be rejected with E017 while externalChange is active
    const batch: OperationBatch = {
      baseRevision: 1,
      ops: [{ op: 'workspace.update', name: 'Rejected Name' }],
      meta: { source: 'user', label: 'update' },
    };
    const applied = await store.applyBatch(batch);
    expect(applied.ok).toBe(false);
    if (!applied.ok) {
      expect(applied.error.code).toBe('E017');
    }

    // After reload, external change flag is cleared and applyBatch succeeds
    await store.reload(store.document(), 1);
    expect(store.hasExternalChange()).toBe(false);

    const appliedAfterReload = await store.applyBatch(batch);
    expect(appliedAfterReload.ok).toBe(true);
  });

  it('ignores file changes made by DesignStore itself', async () => {
    const receivedEvents: ServerEvent[] = [];
    eventBus.subscribe((evt) => {
      receivedEvents.push(evt);
    });

    // Make change via DesignStore and flush
    await store.applyBatch({
      baseRevision: 1,
      ops: [{ op: 'workspace.update', name: 'Internal Save' }],
      meta: { source: 'user', label: 'update' },
    });
    await store.flush();

    // Wait for chokidar debounce window
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Must NOT emit workspace.externalChange
    const extChangeEvt = receivedEvents.find((e) => e.type === 'workspace.externalChange');
    expect(extChangeEvt).toBeUndefined();
    expect(store.hasExternalChange()).toBe(false);
  });
});
