// Capture-phase canvas interaction listeners inside the iframe (SPEC-04.1 section 8).
import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useEditorStore } from '../../store/editor-store.ts';
import { isTypingTarget, shortcutFor } from '../editor/use-editor-shortcuts.ts';
import { chainFromElement } from './chain-from-element.ts';
import { pickTarget } from './pick-target.ts';
import { tryTriggerInlineEdit } from './text-edit/text-edit-session.ts';
import { useTextEditStore } from './text-edit/use-text-edit-store.ts';

type InteractionOptions = {
  readonly iframeDoc: Document | undefined;
  readonly rootId: string | undefined;
};

type Closable = { closest(selector: string): unknown };

function asClosable(target: unknown): Closable | undefined {
  if (typeof target === 'object' && target && 'closest' in target) {
    return target as Closable;
  }
  return undefined;
}

function findClosestNode(target: unknown): HTMLElement | undefined {
  const match = asClosable(target)?.closest('[data-rc-node]');
  if (typeof match === 'object' && match) {
    return match as HTMLElement;
  }
  return undefined;
}

function useCanvasHover(
  iframeDoc: Document | undefined,
  rootId: string | undefined,
  isTextEditing: boolean,
) {
  const hoverNode = useEditorStore((s) => s.hoverNode);

  useLayoutEffect(() => {
    if (iframeDoc === undefined || isTextEditing) return undefined;

    const handlePointerMove = (e: MouseEvent) => {
      const el = e.target ?? iframeDoc.elementFromPoint(e.clientX, e.clientY);
      const chain = chainFromElement(el, rootId);
      hoverNode(chain.at(-1));
    };

    const handlePointerLeave = () => {
      hoverNode(undefined);
    };

    iframeDoc.addEventListener('pointermove', handlePointerMove, true);
    iframeDoc.addEventListener('pointerleave', handlePointerLeave, true);

    return () => {
      iframeDoc.removeEventListener('pointermove', handlePointerMove, true);
      iframeDoc.removeEventListener('pointerleave', handlePointerLeave, true);
    };
  }, [iframeDoc, rootId, hoverNode, isTextEditing]);
}

function useCanvasSelection(
  iframeDoc: Document | undefined,
  rootId: string | undefined,
  isTextEditing: boolean,
) {
  const selectNode = useEditorStore((s) => s.selectNode);
  const toggleNodeSelection = useEditorStore((s) => s.toggleNodeSelection);

  useLayoutEffect(() => {
    if (iframeDoc === undefined) return undefined;

    const handleMouseDown = (e: MouseEvent) => {
      const editingNodeId = useTextEditStore.getState().editingNodeId;
      if (editingNodeId !== undefined) {
        const raw = e.target ?? iframeDoc.elementFromPoint(e.clientX, e.clientY);
        const match = asClosable(raw)?.closest(`[data-rc-node="${editingNodeId}"]`);
        if (typeof match === 'object' && match) {
          return;
        }
      }
      e.preventDefault();
    };

    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0 || useTextEditStore.getState().editingNodeId !== undefined) return;
      const el = e.target ?? iframeDoc.elementFromPoint(e.clientX, e.clientY);
      const chain = chainFromElement(el, rootId);
      const currentSelected = useEditorStore.getState().selectedNodeIds;
      const result = pickTarget({
        chain,
        selected: currentSelected,
        modifiers: { shift: e.shiftKey, deep: e.ctrlKey || e.metaKey },
        // Section 8.2: a locked node is never picked on the Canvas.
        isLocked: (id) => useEditorStore.getState().flatNodes[id]?.locked === true,
      });
      if (result.kind === 'select') {
        selectNode(result.id);
      } else if (result.kind === 'toggle' && result.id !== undefined) {
        toggleNodeSelection(result.id);
      } else {
        selectNode(undefined);
      }
      e.preventDefault();
      e.stopPropagation();
    };

    iframeDoc.addEventListener('mousedown', handleMouseDown, true);
    iframeDoc.addEventListener('click', handleClick, true);
    return () => {
      iframeDoc.removeEventListener('mousedown', handleMouseDown, true);
      iframeDoc.removeEventListener('click', handleClick, true);
    };
  }, [iframeDoc, rootId, selectNode, toggleNodeSelection, isTextEditing]);
}

function useCanvasDblClick(iframeDoc: Document | undefined) {
  const { t } = useTranslation();

  useLayoutEffect(() => {
    if (iframeDoc === undefined) return undefined;

    const handleDblClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const raw = e.target ?? iframeDoc.elementFromPoint(e.clientX, e.clientY);
      const targetEl = findClosestNode(raw);
      if (targetEl !== undefined) {
        const cleanup = tryTriggerInlineEdit(targetEl, t);
        if (cleanup !== undefined) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    iframeDoc.addEventListener('dblclick', handleDblClick, true);
    return () => {
      iframeDoc.removeEventListener('dblclick', handleDblClick, true);
    };
  }, [iframeDoc, t]);
}

function useCanvasEscape(iframeDoc: Document | undefined, isTextEditing: boolean) {
  const selectNode = useEditorStore((s) => s.selectNode);

  useLayoutEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useTextEditStore.getState().editingNodeId !== undefined) return;
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.getAttribute('contenteditable') === 'true';
      if (!isInput) {
        selectNode(undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    if (iframeDoc !== undefined) {
      iframeDoc.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (iframeDoc !== undefined) {
        iframeDoc.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [iframeDoc, selectNode, isTextEditing]);
}

function useCanvasShortcuts(iframeDoc: Document | undefined) {
  useLayoutEffect(() => {
    if (iframeDoc === undefined) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (useTextEditStore.getState().editingNodeId !== undefined) return;
      if (isTypingTarget(e.target ?? undefined)) return;
      const action = shortcutFor(e);
      if (action === 'undo') {
        e.preventDefault();
        useEditorStore.getState().undo();
      } else if (action === 'redo') {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    };
    iframeDoc.addEventListener('keydown', handleKeyDown);
    return () => {
      iframeDoc.removeEventListener('keydown', handleKeyDown);
    };
  }, [iframeDoc]);
}

export function useCanvasInteraction({ iframeDoc, rootId }: InteractionOptions): void {
  const isTextEditing = useTextEditStore((s) => s.editingNodeId !== undefined);
  useCanvasHover(iframeDoc, rootId, isTextEditing);
  useCanvasSelection(iframeDoc, rootId, isTextEditing);
  useCanvasDblClick(iframeDoc);
  useCanvasEscape(iframeDoc, isTextEditing);
  useCanvasShortcuts(iframeDoc);
}
