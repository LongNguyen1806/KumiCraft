// Hook for Canvas Direct Text Editing (SPEC-04 section 10 M-TX, R-TX-01..08).
import { type ElementRef, type ElementSource, parseLocString } from '@reactcraft/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { editSource, fetchElementSource } from '../../api/source-client.ts';
import {
  type BridgeChannel,
  type BridgeTextEditListener,
  studioBridgeChannel,
} from '../selection/bridge-channel.ts';
import { type CanvasMode, useSelectionStore } from '../selection/selection-store.ts';

export type TextEditWarningKey =
  | 'textEdit.errors.expression'
  | 'textEdit.errors.mixed'
  | 'textEdit.errors.readonly'
  | 'textEdit.errors.saveFailed';

export type TextEditWarning = {
  readonly code: 'E023';
  readonly reason: 'expression' | 'mixed' | 'readonly';
  readonly messageKey: TextEditWarningKey;
  readonly loc: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
};

export type UseCanvasTextEditOptions = {
  readonly channel?: BridgeChannel;
  readonly mode?: CanvasMode;
  readonly activeFrameId?: string;
  readonly onOpenEditor?: (file: string, line: number, column: number) => void;
};

export type UseCanvasTextEditReturn = {
  readonly editingRef: ElementRef | undefined;
  readonly warning: TextEditWarning | undefined;
  readonly loopCount: number | undefined;
  readonly isEditing: boolean;
  readonly dismissWarning: () => void;
  readonly openEditorForWarning: () => void;
};

function getWarningForSource(
  source: ElementSource,
  loc: string,
  file: string,
  line: number,
  column: number,
): TextEditWarning | undefined {
  if (source.readonly !== undefined) {
    return {
      code: 'E023',
      reason: 'readonly',
      messageKey: 'textEdit.errors.readonly',
      loc,
      file,
      line,
      column,
    };
  }
  if (source.text.kind === 'expression') {
    return {
      code: 'E023',
      reason: 'expression',
      messageKey: 'textEdit.errors.expression',
      loc,
      file,
      line,
      column,
    };
  }
  if (source.text.kind === 'mixed') {
    return {
      code: 'E023',
      reason: 'mixed',
      messageKey: 'textEdit.errors.mixed',
      loc,
      file,
      line,
      column,
    };
  }
  return undefined;
}

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

function openEditorAt(
  warning: TextEditWarning | undefined,
  onOpenEditor?: (file: string, line: number, column: number) => void,
): void {
  // The server starts the editor of Settings (R-SL-06); the Canvas passes that action in.
  if (warning !== undefined) onOpenEditor?.(warning.file, warning.line, warning.column);
}

type TextEditStateSetters = {
  readonly setWarning: (w: TextEditWarning | undefined) => void;
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
  try {
    const source = await fetchElementSource(parsed);
    const warn = getWarningForSource(source, ref.loc, parsed.file, parsed.line, parsed.column);
    if (warn) {
      setters.setWarning(warn);
      return;
    }
    if (source.text.kind !== 'static') return;

    const instances = findInstanceCount(ref.loc);
    setters.setLoopCount(instances > 1 ? instances : undefined);
    setters.setWarning(undefined);
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

export function useCanvasTextEdit(options: UseCanvasTextEditOptions = {}): UseCanvasTextEditReturn {
  const channel = options.channel ?? studioBridgeChannel;
  const onOpenEditor = options.onOpenEditor;

  const [editingRef, setEditingRef] = useState<ElementRef | undefined>(undefined);
  const [warning, setWarning] = useState<TextEditWarning | undefined>(undefined);
  const [loopCount, setLoopCount] = useState<number | undefined>(undefined);
  const activeSessionRef = useRef<{ ref: ElementRef; source: ElementSource } | undefined>(
    undefined,
  );

  const resetEditing = useCallback(() => {
    setEditingRef(undefined);
    activeSessionRef.current = undefined;
    setLoopCount(undefined);
  }, []);

  const handleCommit = useCallback(
    async (ref: ElementRef, text: string) => {
      try {
        await commitSourceText(activeSessionRef.current?.source, ref, text);
      } catch {
        // Ignored
      }
      resetEditing();
    },
    [resetEditing],
  );

  const handleRequest = useCallback(
    async (ref: ElementRef) => {
      await processTextEditRequest(ref, channel, {
        setWarning,
        setLoopCount,
        setEditingRef,
        setActiveSession: (s) => {
          activeSessionRef.current = s;
        },
      });
    },
    [channel],
  );

  const getActiveRef = useCallback(() => activeSessionRef.current?.ref, []);
  useTextEditBridge(channel, handleRequest, handleCommit, resetEditing, getActiveRef);

  return {
    editingRef,
    warning,
    loopCount,
    isEditing: editingRef !== undefined,
    dismissWarning: useCallback(() => {
      setWarning(undefined);
    }, []),
    openEditorForWarning: useCallback(() => {
      openEditorAt(warning, onOpenEditor);
    }, [warning, onOpenEditor]),
  };
}
