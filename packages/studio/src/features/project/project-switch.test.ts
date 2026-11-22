// Opening another project clears what the Studio read from the one before (spec-log #115).
import type { ProjectInfo } from '@kumicraft/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useHistoryStore } from '../../core/history-store.ts';
import { useProjectStore } from '../../core/project-store.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { useFilesStore } from '../files/files-store.ts';
import { watchProjectSwitch } from './project-switch.ts';

const project = (id: string): ProjectInfo => ({
  id,
  name: id,
  root: `/p/${id}`,
  sourceDir: 'src',
  support: { supported: true, reasons: [], framework: 'vite-react', versions: {}, language: 'ts' },
  needsInstall: false,
  responsiveMode: 'desktop-first',
  frames: [{ id: 'desktop', label: 'Desktop', width: 1440, height: 900 }],
  primaryFrameId: 'desktop',
  backends: [],
  designDirs: {
    pages: ['src/pages'],
    layouts: ['src/layouts'],
    components: ['src/components'],
    drafts: 'src/drafts',
  },
  trusted: true,
});

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
  useProjectStore.getState().setProject(undefined);
  vi.restoreAllMocks();
});

function fillStores(): void {
  useFilesStore.setState({
    projectId: 'pug',
    treeData: { '': [] },
    selectedPath: 'views/index.pug',
  });
  useSelectionStore.setState({ selectedRefs: [{ loc: 'src/App.tsx:1:1', index: 0 }] });
  useChatStore.getState().setDraft('hello');
}

describe('watchProjectSwitch', () => {
  it('clears the file tree, the selection and the chat when another project opens', () => {
    const load = vi.spyOn(useHistoryStore.getState(), 'load').mockResolvedValue();
    useProjectStore.getState().setProject(project('pug'));
    stop = watchProjectSwitch();
    fillStores();

    useProjectStore.getState().setProject(project('test-ui'));

    expect(useFilesStore.getState().treeData).toEqual({});
    expect(useFilesStore.getState().selectedPath).toBeUndefined();
    expect(useSelectionStore.getState().selectedRefs).toEqual([]);
    expect(useChatStore.getState().draft).toBe('');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps everything when the same project is set again (a refresh of its info)', () => {
    useProjectStore.getState().setProject(project('pug'));
    stop = watchProjectSwitch();
    fillStores();

    useProjectStore.getState().setProject(project('pug'));

    expect(useFilesStore.getState().treeData).toEqual({ '': [] });
    expect(useChatStore.getState().draft).toBe('hello');
  });
});

describe('files store', () => {
  it('drops the folders of the project before when the project id changes', () => {
    useFilesStore.setState({ projectId: 'pug', treeData: { '': [] } });
    useFilesStore.getState().setProjectId('test-ui');
    expect(useFilesStore.getState().treeData).toEqual({});
    expect(useFilesStore.getState().projectId).toBe('test-ui');
  });
});
