// Search header and status hint for Library Panel (SPEC-04 M-LB).
import { useTranslation } from 'react-i18next';

import { type ErrorInfo, errorText } from '../../routes/error-text.ts';
import { SelectInFileHint } from '../design/select-in-file-hint.tsx';

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
  readonly errorInfo?: ErrorInfo | undefined;
};

export function LibrarySearchHeader({
  query,
  onQueryChange,
  hasSelection,
  onOpenImagePicker,
  errorInfo,
}: LibrarySearchHeaderProps) {
  const { t } = useTranslation('library');

  return (
    <div className="space-y-2 pb-2">
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          data-testid="library-insert-image"
          disabled={!hasSelection}
          onClick={onOpenImagePicker}
          className="h-7 rounded-md border border-line bg-card-solid px-2.5 text-xs font-medium whitespace-nowrap text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('insertImage', 'Ảnh…')}
        </button>
      </div>

      <LibraryStatusHint hasSelection={hasSelection} errorInfo={errorInfo} />
    </div>
  );
}
