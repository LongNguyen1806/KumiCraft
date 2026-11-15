import type { DraftInfo, DraftsInfo } from '@kumicraft/shared';
import { useEffect, useState } from 'react';

import { createEventsClient, type StudioServerEvent } from '../../api/events-client.ts';
import { isRecord } from '../../api/http.ts';
import { fetchDrafts, fetchProject } from '../../api/project-client.ts';
import { getStoredDraftFile, useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useDraftsRevision } from './drafts-revision.ts';

export type DraftsData = {
  readonly drafts: readonly DraftInfo[];
  readonly draftsDir: string;
  readonly ignored: boolean;
  readonly projectId: string | undefined;
  /** False until the first answer: the panel shows that it is reading, not that there is none. */
  readonly loaded: boolean;
  /** The read failed and there is no list to show (spec-log #122). */
  readonly failed: boolean;
  readonly reload: () => void;
};

function hasDraftFileChange(payload: unknown, draftsDir: string): boolean {
  if (!isRecord(payload)) return false;
  const files = payload['files'];
  if (!Array.isArray(files)) return false;
  return files.some(
    (f) =>
      typeof f === 'string' &&
      (f.startsWith(draftsDir) || f.includes('/drafts/') || f.endsWith('.tsx')),
  );
}

function restoreStoredDraft(
  drafts: readonly DraftInfo[],
  pid: string | undefined,
  openDraft: (file: string, projectId?: string) => void,
): void {
  if (pid === undefined) return;
  const stored = getStoredDraftFile(pid);
  if (
    stored !== undefined &&
    drafts.some((d) => d.file === stored) &&
    useCanvasViewStore.getState().draftFile === undefined
  ) {
    openDraft(stored, pid);
  }
}

function handleDraftsEvent(event: StudioServerEvent, dir: string, onReload: () => void): void {
  if (event.type === 'project.changed') {
    onReload();
    return;
  }
  if (event.type === 'project.filesChanged' && hasDraftFileChange(event.payload, dir)) {
    onReload();
  }
}

/** Reads the drafts and the project id; `show` runs only while the panel still wants them. */
async function readDrafts(
  isActive: () => boolean,
  openDraft: (file: string, projectId?: string) => void,
  show: (info: DraftsInfo, projectId: string | undefined) => void,
): Promise<boolean> {
  try {
    const [draftsInfo, proj] = await Promise.all([
      fetchDrafts(),
      fetchProject().catch(() => undefined),
    ]);
    if (!isActive()) return true;
    show(draftsInfo, proj?.id);
    useCanvasViewStore.getState().setDraftsDir(draftsInfo.dir);
    restoreStoredDraft(draftsInfo.drafts, proj?.id, openDraft);
    return true;
  } catch {
    // Drafts endpoint or project not ready yet.
    return false;
  }
}

/** Reads the list again when a draft file or the project changes. */
function followDraftEvents(dir: string, isActive: () => boolean, load: () => Promise<void>) {
  return createEventsClient({
    onEvent: (event) => {
      if (!isActive()) return;
      handleDraftsEvent(event, dir, () => {
        void load();
      });
    },
  });
}

export function useDrafts(): DraftsData {
  const [data, setData] = useState<DraftsInfo>({
    drafts: [],
    dir: 'src/drafts',
    ignored: false,
  });
  const [projectId, setProjectId] = useState<string | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const openDraft = useCanvasViewStore((s) => s.openDraft);
  const revision = useDraftsRevision((s) => s.revision);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const ok = await readDrafts(
        () => active,
        openDraft,
        (info, pid) => {
          setData(info);
          setProjectId(pid);
        },
      );
      if (!active) return;
      setLoaded(true);
      setFailed(!ok);
    };
    void load();
    const client = followDraftEvents(data.dir, () => active, load);
    return () => {
      active = false;
      client.close();
    };
  }, [data.dir, openDraft, refreshCount, revision]);

  return {
    drafts: data.drafts,
    draftsDir: data.dir,
    ignored: data.ignored,
    projectId,
    loaded,
    failed,
    reload: () => {
      setRefreshCount((c) => c + 1);
    },
  };
}
