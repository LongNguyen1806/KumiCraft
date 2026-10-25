import type { FileTreeEntry } from '@kumicraft/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchFileTree } from '../../api/files-client.ts';
import { Dialog } from '../../components/ui/dialog.tsx';
import { buildVisibleItems, type VisibleItem } from './folder-picker-tree.ts';

export type FolderPickerProps = {
  readonly open: boolean;
  readonly mode: 'folder' | 'file';
  readonly extensions?: readonly string[] | undefined;
  readonly initial?: string | undefined;
  readonly onPick: (path: string) => void;
  readonly onClose: () => void;
};

function PickerToggleIcon({
  path,
  expanded,
  onToggle,
}: {
  readonly path: string;
  readonly expanded: boolean;
  readonly onToggle: (path: string) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      data-testid={`picker-toggle-${path}`}
      className="flex h-4 w-4 items-center justify-center text-ink-soft hover:text-ink"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(path);
      }}
    >
      {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
    </button>
  );
}

function PickerItemRow({
  item,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  readonly item: VisibleItem;
  readonly selected: boolean;
  readonly expanded: boolean;
  readonly onToggle: (path: string) => void;
  readonly onSelect: (entry: FileTreeEntry) => void;
}) {
  const isDir = item.entry.kind === 'directory';
  const paddingLeft = `${String(item.depth * 16 + 8)}px`;

  return (
    <div
      role="treeitem"
      tabIndex={0}
      data-testid={`picker-item-${item.entry.path}`}
      aria-selected={selected}
      className={`flex cursor-pointer items-center gap-1.5 rounded py-1 pr-2 text-xs select-none ${
        selected ? 'bg-primary/20 text-primary font-medium' : 'text-ink hover:bg-hover'
      }`}
      style={{ paddingLeft }}
      onClick={() => {
        onSelect(item.entry);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.entry);
        }
      }}
    >
      {isDir ? (
        <PickerToggleIcon path={item.entry.path} expanded={expanded} onToggle={onToggle} />
      ) : (
        <span className="inline-block h-4 w-4" />
      )}
      <span className="truncate">{item.entry.name}</span>
    </div>
  );
}

async function fetchDirEntries(
  path: string,
  setTreeData: React.Dispatch<
    React.SetStateAction<Readonly<Record<string, readonly FileTreeEntry[]>>>
  >,
) {
  try {
    const res = await fetchFileTree(path);
    setTreeData((prev) => ({ ...prev, [path]: res.entries }));
  } catch {
    // Ignore fetch errors
  }
}

function usePickerTree(
  open: boolean,
  initial: string | undefined,
  mode: 'folder' | 'file',
  extensions?: readonly string[],
) {
  const [treeData, setTreeData] = useState<Readonly<Record<string, readonly FileTreeEntry[]>>>({});
  const [expandedDirs, setExpandedDirs] = useState<ReadonlySet<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | undefined>(initial);
  const [prevInitial, setPrevInitial] = useState(initial);

  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setSelectedPath(initial);
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadRoot = async () => {
      try {
        const res = await fetchFileTree('');
        if (active) setTreeData({ '': res.entries });
      } catch {
        // Ignore fetch errors
      }
    };
    void loadRoot();
    return () => {
      active = false;
    };
  }, [open]);

  const toggleDir = async (path: string) => {
    if (expandedDirs.has(path)) {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
      return;
    }
    setExpandedDirs((prev) => new Set([...prev, path]));
    if (!treeData[path]) {
      await fetchDirEntries(path, setTreeData);
    }
  };

  const visibleItems = useMemo(
    () => buildVisibleItems('', 0, treeData, expandedDirs, mode, extensions),
    [treeData, expandedDirs, mode, extensions],
  );

  return { expandedDirs, selectedPath, setSelectedPath, toggleDir, visibleItems };
}

function FolderPickerFooter({
  canConfirm,
  onClose,
  onConfirm,
}: {
  readonly canConfirm: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        data-testid="folder-picker-cancel"
        onClick={onClose}
        className="rounded border border-border px-3 py-1.5 text-xs text-ink hover:bg-hover"
      >
        {t('files.cancel')}
      </button>
      <button
        type="button"
        data-testid="folder-picker-confirm"
        disabled={!canConfirm}
        onClick={onConfirm}
        className="rounded bg-primary px-3 py-1.5 text-xs text-primary-fg disabled:opacity-50"
      >
        {t('files.select')}
      </button>
    </div>
  );
}

function handlePickerKey(
  e: KeyboardEvent<HTMLDivElement>,
  visibleItems: readonly VisibleItem[],
  selectedPath: string | undefined,
  setSelectedPath: (p: string) => void,
  canConfirm: boolean,
  onPick: (p: string) => void,
  onClose: () => void,
) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    onClose();
  } else if (e.key === 'Enter') {
    if (canConfirm && selectedPath) {
      onPick(selectedPath);
      onClose();
    }
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const idx = visibleItems.findIndex((i) => i.entry.path === selectedPath);
    const nextIdx =
      e.key === 'ArrowDown' ? Math.min(visibleItems.length - 1, idx + 1) : Math.max(0, idx - 1);
    const nextItem = visibleItems[nextIdx];
    if (nextItem) setSelectedPath(nextItem.entry.path);
  }
}

function PickerTreeContent({
  visibleItems,
  selectedPath,
  expandedDirs,
  onToggle,
  onSelect,
}: {
  readonly visibleItems: readonly VisibleItem[];
  readonly selectedPath: string | undefined;
  readonly expandedDirs: ReadonlySet<string>;
  readonly onToggle: (path: string) => void;
  readonly onSelect: (entry: FileTreeEntry) => void;
}) {
  const { t } = useTranslation();
  if (visibleItems.length === 0) {
    return <div className="p-3 text-center text-xs text-ink-soft">{t('files.empty')}</div>;
  }
  return (
    <>
      {visibleItems.map((item) => (
        <PickerItemRow
          key={item.entry.path}
          item={item}
          selected={item.entry.path === selectedPath}
          expanded={expandedDirs.has(item.entry.path)}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

type FolderPickerTreeProps = {
  readonly mode: 'folder' | 'file';
  readonly visibleItems: readonly VisibleItem[];
  readonly selectedPath: string | undefined;
  readonly setSelectedPath: (path: string) => void;
  readonly expandedDirs: ReadonlySet<string>;
  readonly toggleDir: (path: string) => Promise<void>;
  readonly canConfirm: boolean;
  readonly onPick: (path: string) => void;
  readonly onClose: () => void;
};

function FolderPickerTree(props: FolderPickerTreeProps) {
  const { mode, visibleItems, selectedPath, setSelectedPath, expandedDirs, toggleDir } = props;
  const { t } = useTranslation();
  const treeRef = useRef<HTMLDivElement | undefined>(undefined);

  return (
    <div
      ref={(el) => {
        treeRef.current = el ?? undefined;
      }}
      role="tree"
      tabIndex={0}
      aria-label={mode === 'folder' ? t('files.pickFolder') : t('files.pickFile')}
      data-testid="folder-picker-tree"
      onKeyDown={(e) => {
        handlePickerKey(
          e,
          visibleItems,
          selectedPath,
          setSelectedPath,
          props.canConfirm,
          props.onPick,
          props.onClose,
        );
      }}
      className="flex max-h-72 min-h-48 flex-col overflow-y-auto rounded border border-border bg-field p-1 focus:outline-none"
    >
      <PickerTreeContent
        visibleItems={visibleItems}
        selectedPath={selectedPath}
        expandedDirs={expandedDirs}
        onToggle={(path) => {
          void toggleDir(path);
        }}
        onSelect={(entry) => {
          setSelectedPath(entry.path);
          if (entry.kind === 'directory') void toggleDir(entry.path);
        }}
      />
    </div>
  );
}

export function FolderPicker({
  open,
  mode,
  extensions,
  initial,
  onPick,
  onClose,
}: FolderPickerProps) {
  const { t } = useTranslation();
  const { expandedDirs, selectedPath, setSelectedPath, toggleDir, visibleItems } = usePickerTree(
    open,
    initial,
    mode,
    extensions,
  );

  const selectedItem = visibleItems.find((i) => i.entry.path === selectedPath);
  const canConfirm =
    selectedItem !== undefined &&
    (mode === 'folder'
      ? selectedItem.entry.kind === 'directory'
      : selectedItem.entry.kind === 'file');

  const onConfirm = () => {
    if (canConfirm && selectedPath) {
      onPick(selectedPath);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      title={mode === 'folder' ? t('files.pickFolder') : t('files.pickFile')}
      closeLabel={t('files.close')}
      onClose={onClose}
    >
      <FolderPickerTree
        mode={mode}
        visibleItems={visibleItems}
        selectedPath={selectedPath}
        setSelectedPath={setSelectedPath}
        expandedDirs={expandedDirs}
        toggleDir={toggleDir}
        canConfirm={canConfirm}
        onPick={onPick}
        onClose={onClose}
      />
      <FolderPickerFooter canConfirm={canConfirm} onClose={onClose} onConfirm={onConfirm} />
    </Dialog>
  );
}
