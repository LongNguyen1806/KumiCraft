// Hook for Canvas Direct Text Editing (SPEC-04 section 10 M-TX, R-TX-01..08).
import {
  type BridgeTextSelectPayload,
  type EditMode,
  type ElementRef,
  type ElementSource,
  parseLocString,
  type Rect,
} from '@kumicraft/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchElementSource } from '../../api/source-client.ts';
import {
  type BridgeChannel,
  type BridgeTextEditListener,
  studioBridgeChannel,
} from '../../core/bridge-channel.ts';
import { sendEdit } from '../../core/edits.ts';
import { type CanvasMode, useSelectionStore } from '../../core/selection-store.ts';
import { useComponentsStore } from '../components-panel/use-project-components.ts';
import { useDesignStore } from '../design/design-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';

export type UseCanvasTextEditOptions = {
  readonly channel?: BridgeChannel;
  readonly mode?: CanvasMode;
  readonly activeFrameId?: string;
};

export type TextSelectionRange = {
  readonly ref: ElementRef;
  readonly tag: string;
  readonly start: number;
  readonly end: number;
  readonly rect?: Rect | undefined;
};

export type UseCanvasTextEditReturn = {
  readonly editingRef: ElementRef | undefined;
  readonly loopCount: number | undefined;
  readonly isEditing: boolean;
  readonly textSelection: TextSelectionRange | undefined;
  readonly endEditingSession: () => void;
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
  runIndex?: number,
): Promise<void> {
  if (!source || source.loc !== ref.loc) return;
  if (source.text.kind === 'static') {
    await sendEdit({
      edit: {
        kind: 'setText',
        loc: ref.loc,
        tag: source.tag,
        before: source.text.value,
        after: text,
      },
    });
    return;
  }
  if (source.text.kind === 'mixed' && runIndex !== undefined) {
    const run = (source.text.runs ?? []).find((r) => r.kind === 'text' && r.runIndex === runIndex);
    if (run?.kind === 'text') {
      await sendEdit({
        edit: {
          kind: 'setTextRun',
          loc: ref.loc,
          tag: source.tag,
          index: runIndex,
          before: run.value,
          after: text,
        },
      });
    }
  }
}

type TextEditStateSetters = {
  readonly setLoopCount: (c: number | undefined) => void;
  readonly setEditingRef: (r: ElementRef) => void;
  readonly setActiveSession: (s: { ref: ElementRef; source: ElementSource }) => void;
};

function canEditSourceText(source: ElementSource, runIndex?: number): boolean {
  if (source.readonly !== undefined) return false;
  if (source.text.kind === 'static') return true;
  if (source.text.kind === 'mixed' && runIndex !== undefined) {
    return (source.text.runs ?? []).some((r) => r.kind === 'text' && r.runIndex === runIndex);
  }
  return false;
}

async function processTextEditRequest(
  ref: ElementRef,
  runIndex: number | undefined,
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
    if (!canEditSourceText(source, runIndex)) return;

    const instances = findInstanceCount(ref.loc);
    setters.setLoopCount(instances > 1 ? instances : undefined);
    setters.setEditingRef(ref);
    setters.setActiveSession({ ref, source });
    if (runIndex !== undefined) channel.startTextEdit(ref, runIndex);
    else channel.startTextEdit(ref);
  } catch {
    // Ignored
  }
}

function useTextEditBridge(
  channel: BridgeChannel,
  onRequest: (ref: ElementRef, runIndex?: number) => Promise<void>,
  onCommit: (ref: ElementRef, text: string, runIndex?: number) => Promise<void>,
  onCancel: () => void,
  onSelect: (payload: BridgeTextSelectPayload) => void,
  activeRef: () => ElementRef | undefined,
): void {
  useEffect(() => {
    const listener: BridgeTextEditListener = {
      onTextEditRequest: (payload) => {
        void onRequest(payload.ref, payload.runIndex);
      },
      onTextCommit: (payload) => {
        void onCommit(payload.ref, payload.text, payload.runIndex);
      },
      onTextCancel: () => {
        onCancel();
      },
      onTextSelect: (payload) => {
        onSelect(payload);
      },
    };
    return channel.registerTextEditListener(listener);
  }, [channel, onRequest, onCommit, onCancel, onSelect]);

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
  const [textSelection, setTextSelection] = useState<TextSelectionRange | undefined>(undefined);
  const activeSessionRef = useRef<{ ref: ElementRef; source: ElementSource } | undefined>(
    undefined,
  );

  const resetEditing = useCallback(() => {
    setEditingRef(undefined);
    activeSessionRef.current = undefined;
    setLoopCount(undefined);
    setTextSelection(undefined);
  }, []);

  return {
    editingRef,
    setEditingRef,
    loopCount,
    setLoopCount,
    textSelection,
    setTextSelection,
    activeSessionRef,
    resetEditing,
  };
}

type TextEditState = ReturnType<typeof useTextEditState>;

function useTextEditHandlers(channel: BridgeChannel, state: TextEditState, editMode: EditMode) {
  const { activeSessionRef, resetEditing, setLoopCount, setEditingRef, setTextSelection } = state;

  const handleCommit = useCallback(
    async (ref: ElementRef, text: string, runIndex?: number) => {
      try {
        await commitSourceText(activeSessionRef.current?.source, ref, text, runIndex);
      } catch {
        // Ignored
      }
      resetEditing();
    },
    [activeSessionRef, resetEditing],
  );

  const handleRequest = useCallback(
    async (ref: ElementRef, runIndex?: number) => {
      if (editMode === 'viewOnly') return;
      await processTextEditRequest(ref, runIndex, channel, {
        setLoopCount,
        setEditingRef,
        setActiveSession: (s) => {
          activeSessionRef.current = s;
        },
      });
    },
    [channel, activeSessionRef, setEditingRef, setLoopCount, editMode],
  );

  const handleTextSelect = useCallback(
    (payload: BridgeTextSelectPayload) => {
      const session = activeSessionRef.current;
      if (!session || session.ref.loc !== payload.ref.loc || payload.end <= payload.start) {
        setTextSelection(undefined);
        return;
      }
      setTextSelection({
        ref: payload.ref,
        tag: session.source.tag,
        start: payload.start,
        end: payload.end,
        rect: payload.rect,
      });
    },
    [activeSessionRef, setTextSelection],
  );

  const getActiveRef = useCallback(() => activeSessionRef.current?.ref, [activeSessionRef]);

  return { handleCommit, handleRequest, handleTextSelect, getActiveRef };
}

export function useCanvasTextEdit(options: UseCanvasTextEditOptions = {}): UseCanvasTextEditReturn {
  const channel = options.channel ?? studioBridgeChannel;
  const editMode = useEditMode();
  const state = useTextEditState();
  const { handleCommit, handleRequest, handleTextSelect, getActiveRef } = useTextEditHandlers(
    channel,
    state,
    editMode,
  );

  useTextEditBridge(
    channel,
    handleRequest,
    handleCommit,
    state.resetEditing,
    handleTextSelect,
    getActiveRef,
  );

  const endEditingSession = useCallback(() => {
    const cur = getActiveRef();
    if (cur !== undefined) {
      channel.endTextEdit(cur);
    }
    state.resetEditing();
  }, [channel, getActiveRef, state]);

  return {
    editingRef: state.editingRef,
    loopCount: state.loopCount,
    isEditing: state.editingRef !== undefined,
    textSelection: state.textSelection,
    endEditingSession,
  };
}
