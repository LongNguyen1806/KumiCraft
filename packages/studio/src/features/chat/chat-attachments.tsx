// Attachments bar rendering backends, docs, and images for chat (R-CH-02, R-MR-01, CW-52).
import type { BackendInfo } from '@reactcraft/shared';
import { FileText, Folder, Loader2, Server, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { isDocFilePath } from './chat-docs.tsx';
import type { ChatImageAttachment } from './chat-store.ts';

function BackendChip({
  backend,
  onRemove,
}: {
  readonly backend: BackendInfo;
  readonly onRemove: (id: string) => void;
}) {
  const { t } = useTranslation('chat');
  return (
    <span
      data-testid={`chat-backend-${backend.id}`}
      className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft"
    >
      <Server className="size-3 shrink-0 text-ink-faint" />
      <span className="truncate max-w-[150px]">{backend.label}</span>
      <button
        type="button"
        aria-label={t('remove')}
        onClick={() => {
          onRemove(backend.id);
        }}
        className="rounded-full p-0.5 hover:bg-field-hover text-ink-faint hover:text-ink cursor-pointer"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function DocChip({
  doc,
  index,
  onRemove,
}: {
  readonly doc: string;
  readonly index: number;
  readonly onRemove: (doc: string) => void;
}) {
  const { t } = useTranslation('chat');
  const isFile = isDocFilePath(doc);
  return (
    <span
      data-testid={`chat-doc-${String(index)}`}
      className="inline-flex items-center gap-1 rounded-full bg-field px-2.5 py-0.5 text-[11px] text-ink-soft"
    >
      {isFile ? (
        <FileText className="size-3 shrink-0 text-ink-faint" />
      ) : (
        <Folder className="size-3 shrink-0 text-ink-faint" />
      )}
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

function ImageChip({
  image,
  index,
  onRemove,
}: {
  readonly image: ChatImageAttachment;
  readonly index: number;
  readonly onRemove: (localId: string) => void;
}) {
  const { t } = useTranslation('chat');
  return (
    <div
      data-testid={`chat-image-${String(index)}`}
      className="relative size-12 shrink-0 rounded-lg overflow-hidden border border-line bg-field"
    >
      <img src={image.previewUrl} alt={image.localId} className="size-full object-cover" />
      {image.state === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-charcoal/50">
          <Loader2 className="size-4 animate-spin text-paper" />
        </div>
      )}
      <button
        type="button"
        aria-label={t('remove')}
        onClick={() => {
          onRemove(image.localId);
        }}
        className="absolute top-0.5 right-0.5 rounded-full bg-charcoal/70 p-0.5 text-paper hover:bg-charcoal cursor-pointer"
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}

export type ChatAttachmentsProps = {
  readonly backends: readonly BackendInfo[];
  readonly docs: readonly string[];
  readonly images: readonly ChatImageAttachment[];
  readonly backendError?: string | undefined;
  readonly imageError?: string | undefined;
  readonly onRemoveBackend: (id: string) => void;
  readonly onRemoveDoc: (doc: string) => void;
  readonly onRemoveImage: (localId: string) => void;
};

export function ChatAttachments({
  backends,
  docs,
  images,
  backendError,
  imageError,
  onRemoveBackend,
  onRemoveDoc,
  onRemoveImage,
}: ChatAttachmentsProps) {
  const hasChips = backends.length > 0 || docs.length > 0 || images.length > 0;
  if (!hasChips && backendError === undefined && imageError === undefined) {
    return undefined;
  }

  return (
    <div data-testid="chat-attachments" className="flex flex-col gap-1.5 px-1 shrink-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {backends.map((b) => (
          <BackendChip key={b.id} backend={b} onRemove={onRemoveBackend} />
        ))}
        {docs.map((doc, idx) => (
          <DocChip key={doc} doc={doc} index={idx} onRemove={onRemoveDoc} />
        ))}
        {images.map((img, idx) => (
          <ImageChip key={img.localId} image={img} index={idx} onRemove={onRemoveImage} />
        ))}
      </div>
      {backendError !== undefined && (
        <p data-testid="chat-backend-error" className="text-xs text-danger">
          {backendError}
        </p>
      )}
      {imageError !== undefined && (
        <p data-testid="chat-image-error" className="text-xs text-danger">
          {imageError}
        </p>
      )}
    </div>
  );
}
