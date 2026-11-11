// AI chat actions: new conversation, import folder, add image (R-CH-02, CW-52); the model sits by Send.
import { FolderPlus, History, ImagePlus, Plus } from 'lucide-react';
import type React from 'react';
import { useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { PanelHeaderContext } from '../editor/panel-header-context.ts';
import { useChatStore } from './chat-store.ts';

function NewConversationButton({ disabled }: { readonly disabled: boolean }) {
  const { t } = useTranslation('chat');
  return (
    <button
      type="button"
      data-testid="chat-new-conversation"
      title={t('newConversation')}
      aria-label={t('newConversation')}
      disabled={disabled}
      onClick={() => {
        useChatStore.getState().newConversation();
      }}
      className="flex size-6 items-center justify-center rounded-md text-ink-soft hover:bg-field hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

type ImportButtonProps = {
  readonly disabled: boolean;
  readonly onOpenImport: () => void;
};

function ImportButton({ disabled, onOpenImport }: ImportButtonProps) {
  const { t } = useTranslation('chat');
  return (
    <button
      type="button"
      data-testid="chat-import"
      title={t('import.button')}
      aria-label={t('import.button')}
      disabled={disabled}
      onClick={onOpenImport}
      className="flex size-6 items-center justify-center rounded-md text-ink-soft hover:bg-field hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
    >
      <FolderPlus className="size-3.5" />
    </button>
  );
}

function SessionsButton({ onOpen }: { readonly onOpen: () => void }) {
  const { t } = useTranslation('chat');
  return (
    <button
      type="button"
      data-testid="chat-open-sessions"
      title={t('sessions.title')}
      aria-label={t('sessions.title')}
      onClick={onOpen}
      className="flex size-6 items-center justify-center rounded-md text-ink-soft hover:bg-field hover:text-ink"
    >
      <History className="size-3.5" />
    </button>
  );
}

type ToolbarActionButtonsProps = {
  readonly onOpenSessions: () => void;
  readonly disabled: boolean;
  readonly onOpenImport: () => void;
  readonly onPickImages: (files: FileList | readonly File[]) => void;
};

function ToolbarActionButtons({
  disabled,
  onOpenSessions,
  onOpenImport,
  onPickImages,
}: ToolbarActionButtonsProps) {
  const { t } = useTranslation('chat');
  const fileInputRef = useRef<HTMLInputElement | undefined>(undefined);
  const headerSlot = useContext(PanelHeaderContext);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onPickImages(files);
      e.target.value = '';
    }
  };

  const content = (
    <div className="flex items-center gap-1">
      <SessionsButton onOpen={onOpenSessions} />
      <NewConversationButton disabled={disabled} />
      <ImportButton disabled={disabled} onOpenImport={onOpenImport} />
      <button
        type="button"
        data-testid="chat-add-image"
        title={t('image.button')}
        aria-label={t('image.button')}
        disabled={disabled}
        onClick={() => {
          fileInputRef.current?.click();
        }}
        className="flex size-6 items-center justify-center rounded-md text-ink-soft hover:bg-field hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
      >
        <ImagePlus className="size-3.5" />
      </button>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        tabIndex={-1}
        className="hidden"
        ref={(el) => {
          fileInputRef.current = el ?? undefined;
        }}
        onChange={handleFileChange}
      />
    </div>
  );

  return headerSlot !== undefined ? createPortal(content, headerSlot) : content;
}

export type ChatToolbarProps = {
  readonly disabled?: boolean | undefined;
  readonly onOpenSessions: () => void;
  readonly onOpenImport: () => void;
  readonly onPickImages: (files: FileList | readonly File[]) => void;
};

/** New conversation, import and image: icons in the panel header, or a row when there is none. */
export function ChatToolbar({
  disabled = false,
  onOpenSessions,
  onOpenImport,
  onPickImages,
}: ChatToolbarProps) {
  const headerSlot = useContext(PanelHeaderContext);
  const buttons = (
    <ToolbarActionButtons
      disabled={disabled}
      onOpenSessions={onOpenSessions}
      onOpenImport={onOpenImport}
      onPickImages={onPickImages}
    />
  );
  if (headerSlot !== undefined) return buttons;
  return (
    <div
      data-testid="chat-toolbar"
      className="flex items-center pb-1.5 border-b border-line px-1 shrink-0"
    >
      {buttons}
    </div>
  );
}
