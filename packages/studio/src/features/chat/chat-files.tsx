// List of changed files with diff drawer and open-in-editor action (WP-3.05b, R-CH-04).
import type { TurnFile, TurnFileChange } from '@kumicraft/shared';
import type { VirtualItem } from '@tanstack/react-virtual';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { openInEditor } from '../../api/editor-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { ChatDiff } from './chat-diff.tsx';
import { useVirtualFileRows } from './use-virtual-file-rows.ts';

export type ChatFilesProps = {
  readonly turnId: string;
  readonly files: readonly TurnFile[];
};

function ChangeBadge({ change }: { readonly change: TurnFileChange }) {
  if (change === 'created') {
    return <span className="font-mono text-[11px] font-bold text-emerald-600">A</span>;
  }
  if (change === 'deleted') {
    return <span className="font-mono text-[11px] font-bold text-rose-600">D</span>;
  }
  return <span className="font-mono text-[11px] font-bold text-amber-600">M</span>;
}

type FileRowProps = {
  readonly file: TurnFile;
  readonly index: number;
  readonly turnId: string;
  readonly isSelected: boolean;
  readonly onToggleDiff: () => void;
  readonly openError?: string | undefined;
  readonly onOpenInEditor: () => void;
};

function FileRow({
  file,
  index,
  turnId,
  isSelected,
  onToggleDiff,
  openError,
  onOpenInEditor,
}: FileRowProps) {
  const { t } = useTranslation('chat');

  return (
    <div className="flex flex-col border-b border-border/40 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs hover:bg-field/50">
        <button
          type="button"
          data-testid={`chat-file-${String(index)}`}
          data-change={file.change}
          onClick={onToggleDiff}
          className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer bg-transparent border-0 p-0"
        >
          <ChangeBadge change={file.change} />
          <span className="truncate font-mono text-[11px] text-ink">{file.path}</span>
        </button>
        {file.change !== 'deleted' && (
          <button
            type="button"
            data-testid={`chat-file-open-${String(index)}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenInEditor();
            }}
            className="flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[11px] text-ink-faint hover:bg-field hover:text-ink cursor-pointer"
            title={t('openInEditor')}
          >
            <ExternalLink className="size-3" />
            <span>{t('openInEditor')}</span>
          </button>
        )}
      </div>
      {openError !== undefined && (
        <div className="px-2 py-0.5 text-[11px] text-rose-600 bg-rose-50/50">{openError}</div>
      )}
      {isSelected && (
        <div className="px-2 py-1">
          <ChatDiff turnId={turnId} path={file.path} />
        </div>
      )}
    </div>
  );
}

function VirtualRowItem({
  virtualItem,
  file,
  turnId,
  isSelected,
  onToggle,
  openError,
  onOpen,
}: {
  readonly virtualItem: VirtualItem;
  readonly file: TurnFile;
  readonly turnId: string;
  readonly isSelected: boolean;
  readonly onToggle: () => void;
  readonly openError?: string | undefined;
  readonly onOpen: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${String(virtualItem.start)}px)`,
      }}
    >
      <FileRow
        file={file}
        index={virtualItem.index}
        turnId={turnId}
        isSelected={isSelected}
        onToggleDiff={onToggle}
        openError={openError}
        onOpenInEditor={onOpen}
      />
    </div>
  );
}

type VirtualFileListProps = {
  readonly files: readonly TurnFile[];
  readonly turnId: string;
  readonly selectedPath?: string | undefined;
  readonly onToggle: (path: string) => void;
  readonly openErrors: Readonly<Record<string, string>>;
  readonly onOpen: (path: string) => void;
};

/** Rows of a virtual list; mounted only once its scroll box exists (ADR-FE-21). */
function VirtualRows({
  scrollElement,
  files,
  turnId,
  selectedPath,
  onToggle,
  openErrors,
  onOpen,
}: VirtualFileListProps & { readonly scrollElement: HTMLDivElement }) {
  const { items, totalSize } = useVirtualFileRows(files.length, scrollElement);
  return (
    <div style={{ height: `${String(totalSize)}px`, width: '100%', position: 'relative' }}>
      {items.map((virtualItem) => {
        const file = files[virtualItem.index];
        if (file === undefined) return undefined;
        return (
          <VirtualRowItem
            key={String(virtualItem.index)}
            virtualItem={virtualItem}
            file={file}
            turnId={turnId}
            isSelected={selectedPath === file.path}
            onToggle={() => {
              onToggle(file.path);
            }}
            openError={openErrors[file.path]}
            onOpen={() => {
              onOpen(file.path);
            }}
          />
        );
      })}
    </div>
  );
}

function VirtualFileList(props: VirtualFileListProps) {
  // The virtualizer needs the scroll box itself, so the rows wait until React has attached it.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement>();
  return (
    <div
      ref={(el) => {
        setScrollElement(el ?? undefined);
      }}
      className="max-h-64 overflow-auto border border-border/60 rounded relative"
    >
      {scrollElement !== undefined && <VirtualRows {...props} scrollElement={scrollElement} />}
    </div>
  );
}

function NormalFileList({
  files,
  turnId,
  selectedPath,
  onToggle,
  openErrors,
  onOpen,
}: {
  readonly files: readonly TurnFile[];
  readonly turnId: string;
  readonly selectedPath?: string | undefined;
  readonly onToggle: (path: string) => void;
  readonly openErrors: Readonly<Record<string, string>>;
  readonly onOpen: (path: string) => void;
}) {
  return (
    <div className="flex flex-col border border-border/60 rounded">
      {files.map((file, index) => (
        <FileRow
          key={file.path}
          file={file}
          index={index}
          turnId={turnId}
          isSelected={selectedPath === file.path}
          onToggleDiff={() => {
            onToggle(file.path);
          }}
          openError={openErrors[file.path]}
          onOpenInEditor={() => {
            onOpen(file.path);
          }}
        />
      ))}
    </div>
  );
}

export function ChatFiles({ turnId, files }: ChatFilesProps) {
  const { t: tError } = useTranslation('errors');
  const [selectedPath, setSelectedPath] = useState<string>();
  const [openErrors, setOpenErrors] = useState<Readonly<Record<string, string>>>({});

  if (files.length === 0) return undefined;

  const handleToggle = (path: string) => {
    setSelectedPath((curr) => (curr === path ? undefined : path));
  };

  const handleOpen = async (path: string) => {
    try {
      await openInEditor(`${path}:1:1`);
      setOpenErrors((prev) => {
        const { [path]: _, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      const info = toErrorInfo(err);
      setOpenErrors((prev) => ({ ...prev, [path]: errorText(tError, info.code, info.params) }));
    }
  };

  return (
    <div data-testid="chat-files" className="flex flex-col gap-1 pt-1">
      {files.length > 50 ? (
        <VirtualFileList
          files={files}
          turnId={turnId}
          selectedPath={selectedPath}
          onToggle={handleToggle}
          openErrors={openErrors}
          onOpen={(path) => {
            void handleOpen(path);
          }}
        />
      ) : (
        <NormalFileList
          files={files}
          turnId={turnId}
          selectedPath={selectedPath}
          onToggle={handleToggle}
          openErrors={openErrors}
          onOpen={(path) => {
            void handleOpen(path);
          }}
        />
      )}
    </div>
  );
}
