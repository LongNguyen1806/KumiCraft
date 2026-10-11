// Workspace external file watcher (SPEC-03 section 11.3, SPEC-04.1 section 3.4, ADR-BE-20).
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import { WORKSPACE_DIR } from '@reactcraft/model';
import chokidar, { type FSWatcher } from 'chokidar';

import type { DesignStore } from '../../core/design-store/design-store.ts';
import type { EventBusPort } from '../../core/ports/event-bus-port.ts';
import type { LoggerPort } from '../../core/ports/logger-port.ts';

const WINDOW_MS = 500; // V-70
const MAX_FILES = 100; // V-70

export type WorkspaceWatcherDeps = {
  readonly root: string;
  readonly getStore: () => DesignStore | undefined;
  readonly eventBus: EventBusPort;
  readonly logger: LoggerPort;
};

export type WorkspaceWatcher = {
  readonly ready: Promise<void>;
  close(): Promise<void>;
};

const sha256 = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex');

function isWatchedWorkspaceFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  if (!normalized.startsWith(`${WORKSPACE_DIR}/`)) return false;
  if (normalized.startsWith(`${WORKSPACE_DIR}/backups/`)) return false;
  if (normalized === `${WORKSPACE_DIR}/lock`) return false;
  if (normalized === `${WORKSPACE_DIR}/.gitignore`) return false;
  return normalized.endsWith('.json');
}

function createChangeEmitter(deps: WorkspaceWatcherDeps) {
  const pendingFiles = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function scheduleEmit(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      const fileList = Array.from(pendingFiles);
      pendingFiles.clear();
      if (fileList.length === 0) return;

      const truncated = fileList.length > MAX_FILES;
      const files = truncated ? fileList.slice(0, MAX_FILES) : fileList;

      deps.eventBus.publish('workspace.externalChange', {
        files,
        ...(truncated ? { truncated: true } : {}),
      });
    }, WINDOW_MS);
  }

  return {
    add(file: string): void {
      pendingFiles.add(file);
      scheduleEmit();
    },
    clear(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      pendingFiles.clear();
    },
  };
}

async function isExternalFileChange(
  fullPath: string,
  relPath: string,
  store: DesignStore,
): Promise<boolean> {
  let contentHash: string | undefined;
  try {
    const text = await readFile(fullPath, 'utf8');
    contentHash = sha256(text);
  } catch {
    contentHash = undefined;
  }
  const knownHash = store.getFileHash(relPath);
  if (contentHash !== undefined && knownHash !== undefined && contentHash === knownHash) {
    return false;
  }
  return true;
}

export function createWorkspaceWatcher(deps: WorkspaceWatcherDeps): WorkspaceWatcher {
  const watchDir = resolve(deps.root, WORKSPACE_DIR);
  const emitter = createChangeEmitter(deps);

  async function handleFileChange(fullPath: string): Promise<void> {
    const relPath = relative(deps.root, fullPath).replace(/\\/g, '/');
    if (!isWatchedWorkspaceFile(relPath)) return;

    const store = deps.getStore();
    if (!store) return;

    const isExternal = await isExternalFileChange(fullPath, relPath, store);
    if (!isExternal) return;

    store.markExternalChange();
    emitter.add(relPath);
  }

  const watcher: FSWatcher = chokidar.watch(watchDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on('add', (filePath: string) => {
    void handleFileChange(filePath);
  });
  watcher.on('change', (filePath: string) => {
    void handleFileChange(filePath);
  });
  watcher.on('unlink', (filePath: string) => {
    void handleFileChange(filePath);
  });

  const ready = new Promise<void>((resolve) => {
    watcher.on('ready', () => {
      resolve();
    });
  });

  return {
    ready,
    async close(): Promise<void> {
      emitter.clear();
      await watcher.close();
    },
  };
}
