// Inline text editing session manager (SPEC-04.1 section 8.4).
import type { TFunction } from 'i18next';

import { useEditorStore } from '../../../store/editor-store.ts';
import { finishTextEdit } from './finish-text-edit.ts';
import { useTextEditStore } from './use-text-edit-store.ts';

const EDITABLE_TYPES = new Set(['Button', 'Link', 'Text', 'Heading']);

type SessionCleanup = () => void;

function selectAllText(el: HTMLElement) {
  el.focus();
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  const range = doc.createRange();
  range.selectNodeContents(el);
  const sel = win?.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function insertTextAtCursor(el: HTMLElement, text: string) {
  const doc = el.ownerDocument;
  const sel = doc.defaultView?.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = doc.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  el.appendChild(doc.createTextNode(text));
}

function handlePasteAsPlain(e: ClipboardEvent, el: HTMLElement) {
  e.preventDefault();
  const plainText = e.clipboardData?.getData('text/plain') ?? '';
  insertTextAtCursor(el, plainText);
}

function commitEdit(
  nodeId: string,
  nodeType: string,
  originalText: string,
  el: HTMLElement,
  t: TFunction,
) {
  const rawEdited = el.innerText;
  useTextEditStore.getState().endEdit();
  const result = finishTextEdit({ original: originalText, edited: rawEdited, nodeType });

  if (result.kind === 'commit') {
    const state = useEditorStore.getState();
    const pageId = state.activePageId;
    if (pageId !== undefined) {
      const res = state.dispatch(
        [
          {
            op: 'setContent',
            target: { kind: 'page', pageId },
            nodeId,
            set: { text: result.text },
          },
        ],
        { source: 'user', label: 'Edit text', coalesce: false },
      );
      if (!res.ok) {
        useTextEditStore.getState().setStatusNotice(t('overlay.editFailed'));
      }
    }
  }
}

function cancelEdit(originalText: string, el: HTMLElement) {
  el.innerText = originalText;
  useTextEditStore.getState().endEdit();
}

type EditHandlers = {
  readonly onKeyDown: (e: KeyboardEvent) => void;
  readonly onPaste: (e: ClipboardEvent) => void;
  readonly onCompStart: () => void;
  readonly onCompEnd: () => void;
  readonly onBlur: () => void;
};

function attachListeners(el: HTMLElement, handlers: EditHandlers): () => void {
  const doc = el.ownerDocument;
  el.addEventListener('keydown', handlers.onKeyDown, true);
  doc.addEventListener('keydown', handlers.onKeyDown, true);
  el.addEventListener('paste', handlers.onPaste, true);
  el.addEventListener('compositionstart', handlers.onCompStart, true);
  el.addEventListener('compositionend', handlers.onCompEnd, true);
  el.addEventListener('blur', handlers.onBlur, true);

  return () => {
    // Listeners go first: turning editing off blurs the element, and Chromium fires that blur at
    // once, which would otherwise commit an edit the user just cancelled.
    el.removeEventListener('keydown', handlers.onKeyDown, true);
    doc.removeEventListener('keydown', handlers.onKeyDown, true);
    el.removeEventListener('paste', handlers.onPaste, true);
    el.removeEventListener('compositionstart', handlers.onCompStart, true);
    el.removeEventListener('compositionend', handlers.onCompEnd, true);
    el.removeEventListener('blur', handlers.onBlur, true);
    el.contentEditable = 'false';
  };
}

function handleSessionKey(
  e: KeyboardEvent,
  nodeType: string,
  isComposing: boolean,
  onCommit: () => void,
  onCancel: () => void,
) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
    return;
  }
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      if (nodeType === 'Text') return;
      e.preventDefault();
      return;
    }
    if (!isComposing) {
      e.preventDefault();
      e.stopPropagation();
      onCommit();
      return;
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.stopPropagation();
  }
}

function createSessionHandlers(
  targetEl: HTMLElement,
  nodeId: string,
  nodeType: string,
  originalText: string,
  t: TFunction,
  onFinish: () => void,
): EditHandlers {
  let isComposing = false;

  const onCommit = () => {
    onFinish();
    commitEdit(nodeId, nodeType, originalText, targetEl, t);
    targetEl.blur();
  };

  const onCancel = () => {
    onFinish();
    cancelEdit(originalText, targetEl);
    targetEl.blur();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    handleSessionKey(e, nodeType, isComposing || e.isComposing, onCommit, onCancel);
  };

  const onBlur = () => {
    if (isComposing) {
      targetEl.addEventListener('compositionend', onCommit, { once: true });
      return;
    }
    onCommit();
  };

  return {
    onKeyDown,
    onPaste: (e) => {
      handlePasteAsPlain(e, targetEl);
    },
    onCompStart: () => {
      isComposing = true;
    },
    onCompEnd: () => {
      isComposing = false;
    },
    onBlur,
  };
}

export function startTextEditSession(
  targetEl: HTMLElement,
  nodeId: string,
  nodeType: string,
  originalText: string,
  t: TFunction,
): SessionCleanup {
  targetEl.contentEditable = 'plaintext-only';
  if (targetEl.contentEditable !== 'plaintext-only') {
    targetEl.contentEditable = 'true';
  }

  targetEl.ownerDocument.defaultView?.focus();
  targetEl.focus();
  useTextEditStore.getState().startEdit(nodeId, originalText);
  selectAllText(targetEl);

  let finished = false;
  let detach: () => void = () => {};

  const onFinish = () => {
    if (finished) return;
    finished = true;
    detach();
  };

  const handlers = createSessionHandlers(targetEl, nodeId, nodeType, originalText, t, onFinish);
  detach = attachListeners(targetEl, handlers);

  return onFinish;
}

export function tryTriggerInlineEdit(
  targetEl: HTMLElement,
  t: TFunction,
): SessionCleanup | undefined {
  if (targetEl.hasAttribute('data-rc-inner') || targetEl.closest('[data-rc-inner]')) {
    return undefined;
  }
  const rawId = targetEl.getAttribute('data-rc-node');
  const nodeId = rawId ?? undefined;
  if (nodeId === undefined) return undefined;

  const node = useEditorStore.getState().flatNodes[nodeId];
  if (node === undefined || node.locked || !EDITABLE_TYPES.has(node.type)) {
    return undefined;
  }

  if (node.bindings?.['text'] !== undefined) {
    useTextEditStore.getState().setStatusNotice(t('overlay.textFromData'));
    return undefined;
  }

  const content = node.content as { runs?: readonly unknown[]; text?: string } | undefined;
  if (Array.isArray(content?.runs) && content.runs.length > 0) {
    useTextEditStore.getState().setStatusNotice(t('overlay.textHasFormat'));
    return undefined;
  }

  useEditorStore.getState().selectNode(nodeId);
  const originalText = content?.text ?? targetEl.innerText;
  const editable = targetEl.querySelector<HTMLElement>('[data-rc-edit]') ?? targetEl;
  return startTextEditSession(editable, nodeId, node.type, originalText, t);
}
