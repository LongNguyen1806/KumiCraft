// Search header, style preset selector, and status hint for Library Panel (SPEC-04 M-LB, TK-69).
import { LIBRARY_STYLES, type LibraryStyle } from '@kumicraft/shared';
import { useTranslation } from 'react-i18next';

import { type ErrorInfo, errorText } from '../../routes/error-text.ts';
import { SelectInFileHint } from '../design/select-in-file-hint.tsx';
import { isLibraryStyle } from './library-styles.ts';

type LibraryStatusHintProps = {
  readonly hasSelection: boolean;
  readonly errorInfo?: ErrorInfo | undefined;
};

export function LibraryStatusHint({ hasSelection, errorInfo }: LibraryStatusHintProps) {
  const { t } = useTranslation('library');
  const { t: tError } = useTranslation('errors');

  if (!hasSelection) {
    return (
      <p
        data-testid="library-hint"
        className="rounded-md border border-sun bg-sun-soft p-2 text-[11px] text-ink"
      >
        {t('hint')}
      </p>
    );
  }

  if (errorInfo !== undefined && errorInfo.code === 'design.selectInFile') {
    return (
      <p
        data-testid="library-hint"
        className="rounded-md border border-sun bg-sun-soft p-2 text-[11px] text-ink"
      >
        <SelectInFileHint info={errorInfo} />
      </p>
    );
  }

  if (errorInfo !== undefined && errorInfo.code !== 'design.selectInFile') {
    return (
      <p role="alert" className="text-xs text-danger" data-testid="library-error">
        {errorText(tError, errorInfo.code, errorInfo.params)}
      </p>
    );
  }

  return undefined;
}

export type LibrarySearchHeaderProps = {
  readonly query: string;
  readonly onQueryChange: (q: string) => void;
  readonly hasSelection: boolean;
  readonly onOpenImagePicker: () => void;
  readonly onOpenIconPicker?: (() => void) | undefined;
  readonly style?: LibraryStyle | undefined;
  readonly onStyleChange?: ((style: LibraryStyle) => void) | undefined;
  readonly errorInfo?: ErrorInfo | undefined;
};

function LibraryStyleRow({
  style,
  onStyleChange,
}: {
  readonly style: LibraryStyle;
  readonly onStyleChange: (style: LibraryStyle) => void;
}) {
  const { t } = useTranslation('library');
  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor="library-style-select"
        className="text-[11px] font-medium whitespace-nowrap text-ink-soft"
      >
        {t('styleLabel')}
      </label>
      <select
        id="library-style-select"
        data-testid="library-style-select"
        value={style}
        onChange={(e) => {
          const next = e.target.value;
          if (isLibraryStyle(next)) onStyleChange(next);
        }}
        className="h-7 min-w-0 flex-1 rounded-md border border-line bg-card-solid px-2 text-xs text-ink"
      >
        {LIBRARY_STYLES.map((preset) => (
          <option key={preset} value={preset}>
            {t(`styles.${preset}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LibrarySearchHeader({
  query,
  onQueryChange,
  hasSelection,
  onOpenImagePicker,
  onOpenIconPicker,
  style = 'default',
  onStyleChange,
  errorInfo,
}: LibrarySearchHeaderProps) {
  const { t } = useTranslation('library');

  return (
    <div className="space-y-2 pb-2">
      {onStyleChange !== undefined && (
        <LibraryStyleRow style={style} onStyleChange={onStyleChange} />
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="search"
          data-testid="library-search"
          placeholder={t('search')}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-card-solid px-2.5 text-xs text-ink placeholder:text-ink-faint"
        />
        {onOpenIconPicker !== undefined && (
          <button
            type="button"
            data-testid="library-open-icons"
            disabled={!hasSelection}
            onClick={onOpenIconPicker}
            className="h-7 rounded-md border border-line bg-card-solid px-2 text-xs font-medium whitespace-nowrap text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('openIcons')}
          </button>
        )}
        <button
          type="button"
          data-testid="library-insert-image"
          disabled={!hasSelection}
          onClick={onOpenImagePicker}
          className="h-7 rounded-md border border-line bg-card-solid px-2 text-xs font-medium whitespace-nowrap text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('insertImage', 'Ảnh…')}
        </button>
      </div>

      <LibraryStatusHint hasSelection={hasSelection} errorInfo={errorInfo} />
    </div>
  );
}
