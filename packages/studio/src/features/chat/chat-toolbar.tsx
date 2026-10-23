// AI chat toolbar with new conversation, import folder, add image, and agent badge (R-CH-02, CW-52).
import type { AgentStatus } from '@reactcraft/shared';
import { FolderPlus, ImagePlus, Plus } from 'lucide-react';
import type React from 'react';
import { useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { AgentBadge } from '../agents/agent-badge.tsx';
import { PanelHeaderContext } from '../editor/panel-header-context.ts';
import { useChatStore } from './chat-store.ts';

function NewConversationButton({ disabled }: { readonly disabled: boolean }) {
  const { t } = useTranslation('chat');
  return (
    <button
      type="button"
      data-testid="chat-new-conversation"
      disabled={disabled}
      onClick={() => {
        useChatStore.getState().newConversation();
      }}
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-ink-soft hover:bg-card-solid hover:text-ink disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
    >
      <Plus className="size-3" />
      <span>{t('newConversation')}</span>
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
      className="flex size-6 items-center justify-center rounded-full text-ink-soft hover:bg-card-solid hover:text-ink disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
    >
      <FolderPlus className="size-3.5" />
    </button>
  );
}

type ToolbarActionButtonsProps = {
  readonly disabled: boolean;
  readonly onOpenImport: () => void;
  readonly onPickImages: (files: FileList | readonly File[]) => void;
};

function ToolbarActionButtons({ disabled, onOpenImport, onPickImages }: ToolbarActionButtonsProps) {
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
        className="flex size-6 items-center justify-center rounded-full text-ink-soft hover:bg-card-solid hover:text-ink disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
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
  readonly activeAgent?: AgentStatus | undefined;
  readonly onOpenImport: () => void;
  readonly onPickImages: (files: FileList | readonly File[]) => void;
};

export function ChatToolbar({
  disabled = false,
  activeAgent,
  onOpenImport,
  onPickImages,
}: ChatToolbarProps) {
  return (
    <div
      data-testid="chat-toolbar"
      className="flex items-center justify-between pb-1.5 border-b border-line px-1 text-xs shrink-0"
    >
      <div className="flex items-center gap-1">
        <NewConversationButton disabled={disabled} />
        <ToolbarActionButtons
          disabled={disabled}
          onOpenImport={onOpenImport}
          onPickImages={onPickImages}
        />
      </div>
      {activeAgent !== undefined && <AgentBadge agent={activeAgent} />}
    </div>
  );
}
