// Document attachments for AI turn (WP-3.05a, R-CH-02).
import { Paperclip, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useChatStore } from './chat-store.ts';

type DocChipProps = {
  readonly doc: string;
  readonly index: number;
  readonly onRemove: (doc: string) => void;
};

function DocChip({ doc, index, onRemove }: DocChipProps) {
  const { t } = useTranslation('chat');
  return (
    <span
      data-testid={`chat-doc-${String(index)}`}
      className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft"
    >
      <span className="truncate max-w-[200px]">{doc}</span>
      <button
        type="button"
        aria-label={t('remove')}
        onClick={() => {
          onRemove(doc);
        }}
        className="rounded-full p-0.5 hover:bg-field-hover text-ink-faint hover:text-ink cursor-pointer"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

type DocInputProps = {
  readonly onAdd: (path: string) => void;
};

function DocInput({ onAdd }: DocInputProps) {
  const { t } = useTranslation('chat');
  const [val, setVal] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = val.trim();
      if (trimmed) {
        onAdd(trimmed);
        setVal('');
      }
    }
  };

  return (
    <input
      type="text"
      data-testid="chat-doc-input"
      placeholder={t('docInputPlaceholder')}
      value={val}
      onChange={(e) => {
        setVal(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      className="w-full rounded-md border border-border bg-field px-2.5 py-1 text-xs text-ink placeholder:text-ink-faint focus:border-ink-soft focus:outline-none"
    />
  );
}

export function ChatDocs() {
  const { t } = useTranslation('chat');
  const docs = useChatStore((s) => s.docs);
  const addDoc = useChatStore((s) => s.addDoc);
  const removeDoc = useChatStore((s) => s.removeDoc);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid="chat-attach"
          title={t('attachDoc')}
          aria-label={t('attachDoc')}
          onClick={() => {
            setOpen((prev) => !prev);
          }}
          disabled={docs.length >= 10}
          className="inline-flex items-center justify-center size-6 rounded-full text-ink-soft hover:bg-field hover:text-ink disabled:opacity-40 cursor-pointer"
        >
          <Paperclip className="size-3.5" />
        </button>
        {docs.map((doc, idx) => (
          <DocChip key={doc} doc={doc} index={idx} onRemove={removeDoc} />
        ))}
      </div>
      {open && (
        <DocInput
          onAdd={(path) => {
            addDoc(path);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
