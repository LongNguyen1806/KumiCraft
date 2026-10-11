import {
  type DesignDocument,
  documentToFiles,
  type OperationBatch,
  workspaceFilePath,
} from '@reactcraft/model';
import { describe, expect, it } from 'vitest';

import { createNodeFileSystem } from '../../adapters/fs/node-file-system.ts';
import {
  createWorkspaceDocument,
  CreateWorkspaceRequestSchema,
} from '../workspace/create-workspace.ts';
import { makeTempDir, platform, sequenceIds, silentLogger } from '../workspace/test-support.ts';
import { createDesignStore } from './design-store.ts';

function sampleDoc(): DesignDocument {
  return createWorkspaceDocument(CreateWorkspaceRequestSchema.parse({ name: 'Store Test' }), {
    newId: sequenceIds(),
    now: new Date(1000),
  });
}

describe('DesignStore', () => {
  it('applies an operation batch and increments revision [R-DS-01]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const fs = createNodeFileSystem(platform);
      const doc = sampleDoc();

      const store = createDesignStore({
        fs,
        root: dir,
        system: { now: () => new Date(1000), pid: 1, hostname: 'host', isProcessAlive: () => true },
        logger: silentLogger,
        initialDocument: doc,
        initialRevision: 1,
      });

      expect(store.revision()).toBe(1);

      const batch: OperationBatch = {
        baseRevision: 1,
        ops: [
          {
            op: 'workspace.update',
            name: 'Renamed Store Test',
          },
        ],
        meta: { source: 'user', label: 'rename' },
      };

      const applied = await store.applyBatch(batch);
      expect(applied.ok).toBe(true);
      if (applied.ok) {
        expect(applied.value.revision).toBe(2);
      }
      expect(store.document().workspace.name).toBe('Renamed Store Test');

      await store.flush();
      const readWs = await fs.readText(dir, workspaceFilePath.workspace());
      expect(readWs.ok).toBe(true);
      if (readWs.ok) {
        expect(readWs.value).toContain('Renamed Store Test');
      }
    } finally {
      await cleanup();
    }
  });

  it('rejects an operation batch with mismatched baseRevision [E017]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const fs = createNodeFileSystem(platform);
      const doc = sampleDoc();

      const store = createDesignStore({
        fs,
        root: dir,
        system: { now: () => new Date(1000), pid: 1, hostname: 'host', isProcessAlive: () => true },
        logger: silentLogger,
        initialDocument: doc,
        initialRevision: 5,
      });

      const batch: OperationBatch = {
        baseRevision: 4, // out of sync
        ops: [{ op: 'workspace.update', name: 'New Name' }],
        meta: { source: 'user', label: 'stale update' },
      };

      const res = await store.applyBatch(batch);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('E017');
      }
    } finally {
      await cleanup();
    }
  });

  it('creates backup and prunes old backups to maximum 20 [R-DS-03]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const fs = createNodeFileSystem(platform);
      const doc = sampleDoc();

      // Write initial workspace files to disk
      for (const [path, content] of Object.entries(documentToFiles(doc))) {
        await fs.writeTextAtomic(dir, path, content);
      }

      let time = 1000000;
      const store = createDesignStore({
        fs,
        root: dir,
        system: {
          now: () => new Date((time += 1000)),
          pid: 1,
          hostname: 'host',
          isProcessAlive: () => true,
        },
        logger: silentLogger,
        initialDocument: doc,
        initialRevision: 1,
      });

      // Apply 25 batches and flush after each to trigger backups
      for (let i = 0; i < 25; i += 1) {
        await store.applyBatch({
          baseRevision: store.revision(),
          ops: [{ op: 'workspace.update', name: `Name ${String(i)}` }],
          meta: { source: 'user', label: `update ${String(i)}` },
        });
        await store.flush();
      }

      const backups = await store.listBackups();
      expect(backups.ok).toBe(true);
      if (backups.ok) {
        const wsBackups = backups.value.filter((b) => b.file.includes('workspace.json'));
        // Pruned to at most 20 backups
        expect(wsBackups.length).toBeLessThanOrEqual(20);
        expect(wsBackups.length).toBe(20);
      }
    } finally {
      await cleanup();
    }
  });

  it('restores a file from backup [R-DS-05]', async () => {
    const { dir, cleanup } = await makeTempDir();
    try {
      const fs = createNodeFileSystem(platform);
      const doc = sampleDoc();

      for (const [path, content] of Object.entries(documentToFiles(doc))) {
        await fs.writeTextAtomic(dir, path, content);
      }

      let time = 1000;
      const store = createDesignStore({
        fs,
        root: dir,
        system: {
          now: () => new Date((time += 1000)),
          pid: 1,
          hostname: 'host',
          isProcessAlive: () => true,
        },
        logger: silentLogger,
        initialDocument: doc,
        initialRevision: 1,
      });

      await store.applyBatch({
        baseRevision: 1,
        ops: [{ op: 'workspace.update', name: 'Updated Name' }],
        meta: { source: 'user', label: 'update' },
      });
      await store.flush();

      const backups = await store.listBackups();
      expect(backups.ok).toBe(true);
      if (backups.ok && backups.value.length > 0) {
        const backupId = backups.value[0]?.id;
        if (backupId) {
          const restored = await store.restoreBackup(backupId);
          expect(restored.ok).toBe(true);
        }
      }
    } finally {
      await cleanup();
    }
  });
});
