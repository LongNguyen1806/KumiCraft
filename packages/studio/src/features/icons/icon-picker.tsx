// Offline Lucide Icon Picker dialog with lazy loading and VI/EN search (K9.7-2 TK-6).
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Dialog } from '../../components/ui/dialog.tsx';
import { matchIconSearch } from './icon-keywords.ts';
import { type IconEntry, loadOfflineIcons, toJsxSvgAttrs } from './icon-svg.ts';

const MAX_RENDERED_ICONS = 140;

export type IconPickerDialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onPick: (icon: IconEntry) => void;
};

function IconPreviewSvg({ icon }: { readonly icon: IconEntry }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {icon.node.map(([tag, attrs], index) =>
        createElement(tag, { key: index, ...toJsxSvgAttrs(attrs) }),
      )}
    </svg>
  );
}

function IconGrid({
  icons,
  emptyLabel,
  onPick,
  onClose,
}: {
  readonly icons: readonly IconEntry[];
  readonly emptyLabel: string;
  readonly onPick: (icon: IconEntry) => void;
  readonly onClose: () => void;
}) {
  if (icons.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-ink-soft" data-testid="icon-picker-empty">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
      {icons.map((icon) => (
        <button
          key={icon.name}
          type="button"
          title={icon.name}
          data-testid={`icon-item-${icon.name}`}
          onClick={() => {
            onPick(icon);
            onClose();
          }}
          className="flex flex-col items-center justify-center gap-1 rounded border border-transparent bg-field p-2 text-ink hover:border-accent hover:bg-card-solid"
        >
          <IconPreviewSvg icon={icon} />
          <span className="w-full truncate text-center text-[10px] text-ink-soft">{icon.name}</span>
        </button>
      ))}
    </div>
  );
}

function useOfflineIcons(open: boolean): readonly IconEntry[] | undefined {
  const [icons, setIcons] = useState<readonly IconEntry[] | undefined>();
  useEffect(() => {
    if (!open || icons !== undefined) return;
    let active = true;
    const load = async () => {
      const list = await loadOfflineIcons();
      if (active) setIcons(list);
    };
    void load();
    return () => {
      active = false;
    };
  }, [open, icons]);
  return icons;
}

function IconSearchBar({
  open,
  query,
  shownCount,
  totalCount,
  onQueryChange,
}: {
  readonly open: boolean;
  readonly query: string;
  readonly shownCount: number;
  readonly totalCount: number | undefined;
  readonly onQueryChange: (value: string) => void;
}) {
  const { t } = useTranslation('library');
  const searchRef = useRef<HTMLInputElement | undefined>(undefined);
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={(el) => {
          searchRef.current = el ?? undefined;
        }}
        type="search"
        data-testid="icon-search"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        placeholder={t('iconPicker.search')}
        className="h-8 flex-1 rounded-md border border-line bg-card-solid px-2.5 text-xs text-ink placeholder:text-ink-faint"
      />
      {totalCount !== undefined && (
        <span className="text-[11px] whitespace-nowrap text-ink-faint">
          {t('iconPicker.count', { shown: shownCount, total: totalCount })}
        </span>
      )}
    </div>
  );
}

export function IconPickerDialog({ open, onClose, onPick }: IconPickerDialogProps) {
  const { t } = useTranslation('library');
  const [query, setQuery] = useState('');
  const icons = useOfflineIcons(open);

  const filtered = useMemo(() => {
    if (!icons) return [];
    return icons.filter((entry) => matchIconSearch(entry.name, query)).slice(0, MAX_RENDERED_ICONS);
  }, [icons, query]);

  if (!open) return undefined;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('iconPicker.title')}
      closeLabel={t('settings.close', { ns: 'common' })}
    >
      <div className="space-y-3" data-testid="icon-picker">
        <IconSearchBar
          open={open}
          query={query}
          shownCount={filtered.length}
          totalCount={icons?.length}
          onQueryChange={setQuery}
        />
        <div className="max-h-72 overflow-y-auto rounded-md border border-line bg-card-solid p-2">
          {icons === undefined ? (
            <div className="py-8 text-center text-xs text-ink-soft">{t('iconPicker.loading')}</div>
          ) : (
            <IconGrid
              icons={filtered}
              emptyLabel={t('iconPicker.empty')}
              onPick={onPick}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}
