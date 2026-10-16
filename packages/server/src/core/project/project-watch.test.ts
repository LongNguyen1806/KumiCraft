// Tests for the project watcher reactions (R-HI-05, V-70, R-PJ-12).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { WORKSPACE_FILE } from '@reactcraft/shared';
import { describe, expect, it, vi } from 'vitest';

import { computeSha256, createHistoryService } from '../history/history-service.ts';
import { createEventBus, type ServerEvent } from '../ports/event-bus-port.ts';
import type { WatcherPort } from '../ports/watcher-port.ts';
import { makeTempDir, nodeFs, silentLogger } from '../workspace/test-support.ts';
import { createProjectWatch, MAX_CHANGED_FILES } from './project-watch.ts';

type FakeWatcher = WatcherPort & {
  readonly roots: string[];
  readonly closed: string[];
  emit(files: readonly string[]): void;
};

function fakeWatcher(): FakeWatcher {
  const roots: string[] = [];
  const closed: string[] = [];
  let onBatch: (files: readonly string[]) => void = () => undefined;
  return {
    roots,
    closed,
    watch(root, callback) {
      roots.push(root);
      onBatch = callback;
      return {
        close: () => {
          closed.push(root);
          return Promise.resolve();
        },
      };
    },
    emit(files) {
      onBatch(files);
    },
  };
}

async function setup() {
  const temp = await makeTempDir();
  await mkdir(join(temp.dir, 'src'), { recursive: true });
  const bus = createEventBus();
  const events: ServerEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const history = createHistoryService({ fs: nodeFs, eventBus: bus });
  const watcher = fakeWatcher();
  const onWorkspaceFileChanged = vi.fn(() => Promise.resolve());
  const watch = createProjectWatch({
    watcher,
    fs: nodeFs,
    history,
    logger: silentLogger,
    eventBus: bus,
    onWorkspaceFileChanged,
  });
  const filesChanged = () => events.filter((e) => e.type === 'project.filesChanged');
  return { ...temp, events, history, watcher, watch, onWorkspaceFileChanged, filesChanged };
}

function pushEdit(
  history: ReturnType<typeof createHistoryService>,
  path: string,
  before: string,
  after: string,
) {
  history.push({
    label: { key: 'history:setText' },
    files: [
      {
        path,
        before,
        after,
        beforeHash: computeSha256(before),
        afterHash: computeSha256(after),
      },
    ],
  });
}

describe('project watch', () => {
  it('ignores a file whose content is what ReactCraft wrote last [R-HI-05]', async () => {
    const t = await setup();
    try {
      await writeFile(join(t.dir, 'src/A.tsx'), 'mine');
      await writeFile(join(t.dir, 'src/B.tsx'), 'from VS Code');
      pushEdit(t.history, 'src/A.tsx', 'old', 'mine');
      t.watch.start(t.dir);

      t.watcher.emit(['src/A.tsx', 'src/B.tsx']);
      await vi.waitFor(() => {
        expect(t.filesChanged()).toHaveLength(1);
      });

      expect(t.filesChanged()[0]?.payload).toEqual({ files: ['src/B.tsx'] });
      expect(t.history.getState().undoCount).toBe(1);
    } finally {
      await t.cleanup();
    }
  });

  it('drops history of a file edited outside and reports it once [R-HI-05]', async () => {
    const t = await setup();
    try {
      await writeFile(join(t.dir, 'src/A.tsx'), 'from VS Code');
      pushEdit(t.history, 'src/A.tsx', 'old', 'mine');
      t.events.length = 0;
      t.watch.start(t.dir);

      t.watcher.emit(['src/A.tsx']);

      await vi.waitFor(() => {
        expect(t.filesChanged()).toHaveLength(1);
      });
      expect(t.filesChanged()[0]?.payload).toEqual({ files: ['src/A.tsx'] });
      expect(t.events.some((e) => e.type === 'history.changed')).toBe(true);
      expect(t.history.getState().undoCount).toBe(0);
    } finally {
      await t.cleanup();
    }
  });

  it('caps one event at 100 files and marks it truncated [V-70]', async () => {
    const t = await setup();
    try {
      const files = Array.from({ length: 150 }, (_, i) => `src/F${String(i)}.tsx`);
      await Promise.all(files.map((f) => writeFile(join(t.dir, f), f)));
      t.watch.start(t.dir);

      t.watcher.emit(files);

      // 150 files are read one by one; a busy test run needs more than the default second.
      await vi.waitFor(
        () => {
          expect(t.filesChanged()).toHaveLength(1);
        },
        { timeout: 10_000 },
      );
      expect(t.filesChanged()[0]?.payload).toEqual({
        files: files.slice(0, MAX_CHANGED_FILES),
        truncated: true,
      });
    } finally {
      await t.cleanup();
    }
  });

  it('hands workspace.json to the project and skips other ReactCraft files [S-84]', async () => {
    const t = await setup();
    try {
      t.watch.start(t.dir);

      t.watcher.emit([WORKSPACE_FILE, '.reactcraft/port']);

      await vi.waitFor(() => {
        expect(t.onWorkspaceFileChanged).toHaveBeenCalledTimes(1);
      });
      expect(t.filesChanged()).toHaveLength(0);
    } finally {
      await t.cleanup();
    }
  });

  it('closes the old watch when another project opens, and on stop [R-PJ-12]', async () => {
    const t = await setup();
    try {
      t.watch.start(join(t.dir, 'one'));
      t.watch.start(join(t.dir, 'two'));
      await t.watch.stop();

      expect(t.watcher.roots).toEqual([join(t.dir, 'one'), join(t.dir, 'two')]);
      expect(t.watcher.closed).toEqual([join(t.dir, 'one'), join(t.dir, 'two')]);
    } finally {
      await t.cleanup();
    }
  });
});
