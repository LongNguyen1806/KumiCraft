// Hook for Canvas Direct Text Editing (SPEC-04 section 10 M-TX, R-TX-01..08).
import {
  type EditMode,
  type ElementRef,
  type ElementSource,
  parseLocString,
} from '@kumicraft/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { editSource, fetchElementSource } from '../../api/source-client.ts';
import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import {
  type BridgeChannel,
  type BridgeTextEditListener,
  studioBridgeChannel,
} from '../selection/bridge-channel.ts';
import { type CanvasMode, useSelectionStore } from '../selection/selection-store.ts';

export type UseCanvasTextEditOptions = {
  readonly channel?: BridgeChannel;
  readonly mode?: CanvasMode;
  readonly activeFrameId?: string;
};

export type UseCanvasTextEditReturn = {
  readonly editingRef: ElementRef | undefined;
  readonly loopCount: number | undefined;
  readonly isEditing: boolean;
};

function findInstanceCount(loc: string): number {
  const treeNodes = useSelectionStore.getState().treeNodes;
  const matchingNode = treeNodes.find((n) => n.ref.loc === loc);
  return matchingNode?.instances ?? 1;
}

async function commitSourceText(
  source: ElementSource | undefined,
  ref: ElementRef,
  text: string,
): Promise<void> {
  if (source && source.loc === ref.loc && source.text.kind === 'static') {
    await editSource({
      edit: {
        kind: 'setText',
        loc: ref.loc,
        tag: source.tag,
        before: source.text.value,
        after: text,
      },
    });
  }
}

type TextEditStateSetters = {
  readonly setLoopCount: (c: number | undefined) => void;
  readonly setEditingRef: (r: ElementRef) => void;
  readonly setActiveSession: (s: { ref: ElementRef; source: ElementSource }) => void;
};

async function processTextEditRequest(
  ref: ElementRef,
  channel: BridgeChannel,
  setters: TextEditStateSetters,
): Promise<void> {
  const parsed = parseLocString(ref.loc);
  if (!parsed) return;

  const currentFile =
    useDesignStore.getState().componentMode?.filePath ?? useDesignStore.getState().target?.file;
  if (currentFile && parsed.file !== currentFile) {
    const components = useComponentsStore.getState().components;
    const comp = components.find((c) => c.file === parsed.file);
    if (comp) {
      useDesignStore.getState().enterComponentMode({
        componentName: comp.name,
        filePath: comp.file,
      });
      return;
    }
  }

  try {
    const source = await fetchElementSource(parsed);
    // Only plain text is edited in place; anything else ignores the double click (spec-log #119):
    // a notice there got in the way of quick clicks, and Open in editor is in the Inspector.
    if (source.readonly !== undefined || source.text.kind !== 'static') return;

    const instances = findInstanceCount(ref.loc);
    setters.setLoopCount(instances > 1 ? instances : undefined);
    setters.setEditingRef(ref);
    setters.setActiveSession({ ref, source });
    channel.startTextEdit(ref);
  } catch {
    // Ignored
  }
}

function useTextEditBridge(
  channel: BridgeChannel,
  onRequest: (ref: ElementRef) => Promise<void>,
  onCommit: (ref: ElementRef, text: string) => Promise<void>,
  onCancel: () => void,
  activeRef: () => ElementRef | undefined,
): void {
  useEffect(() => {
    const listener: BridgeTextEditListener = {
      onTextEditRequest: (payload) => {
        void onRequest(payload.ref);
      },
      onTextCommit: (payload) => {
        void onCommit(payload.ref, payload.text);
      },
      onTextCancel: () => {
        onCancel();
      },
    };
    return channel.registerTextEditListener(listener);
  }, [channel, onRequest, onCommit, onCancel]);

  useEffect(() => {
    return useSelectionStore.subscribe((state, prev) => {
      if (state.mode !== 'design' && prev.mode === 'design') {
        const cur = activeRef();
        if (cur !== undefined) {
          channel.endTextEdit(cur);
          onCancel();
        }
      }
    });
  }, [channel, activeRef, onCancel]);
}

function useTextEditState() {
  const [editingRef, setEditingRef] = useState<ElementRef | undefined>(undefined);
  const [loopCount, setLoopCount] = useState<number | undefined>(undefined);
  const activeSessionRef = useRef<{ ref: ElementRef; source: ElementSource } | undefined>(
    undefined,
  );

  const resetEditing = useCallback(() => {
    setEditingRef(undefined);
    activeSessionRef.current = undefined;
    setLoopCount(undefined);
  }, []);

  return {
    editingRef,
    setEditingRef,
    loopCount,
    setLoopCount,
    activeSessionRef,
    resetEditing,
  };
}

type TextEditState = ReturnType<typeof useTextEditState>;

function useTextEditHandlers(channel: BridgeChannel, state: TextEditState, editMode: EditMode) {
  const { activeSessionRef, resetEditing, setLoopCount, setEditingRef } = state;

  const handleCommit = useCallback(
    async (ref: ElementRef, text: string) => {
      try {
        await commitSourceText(activeSessionRef.current?.source, ref, text);
      } catch {
        // Ignored
      }
      resetEditing();
    },
    [activeSessionRef, resetEditing],
  );

  const handleRequest = useCallback(
    async (ref: ElementRef) => {
      if (editMode === 'viewOnly') return;
      await processTextEditRequest(ref, channel, {
        setLoopCount,
        setEditingRef,
        setActiveSession: (s) => {
          activeSessionRef.current = s;
        },
      });
    },
    [channel, activeSessionRef, setEditingRef, setLoopCount, editMode],
  );

  const getActiveRef = useCallback(() => activeSessionRef.current?.ref, [activeSessionRef]);

  return { handleCommit, handleRequest, getActiveRef };
}

export function useCanvasTextEdit(options: UseCanvasTextEditOptions = {}): UseCanvasTextEditReturn {
  const channel = options.channel ?? studioBridgeChannel;
  const editMode = useEditMode();
  const state = useTextEditState();
  const { handleCommit, handleRequest, getActiveRef } = useTextEditHandlers(
    channel,
    state,
    editMode,
  );

  useTextEditBridge(channel, handleRequest, handleCommit, state.resetEditing, getActiveRef);

  return {
    editingRef: state.editingRef,
    loopCount: state.loopCount,
    isEditing: state.editingRef !== undefined,
  };
}
