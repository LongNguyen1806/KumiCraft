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
        className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-900 dark:text-amber-200"
      >
        {t('hint')}
      </p>
    );
  }

  if (errorInfo !== undefined && errorInfo.code === 'design.selectInFile') {
    return (
      <p
        data-testid="library-hint"
        className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-[11px] text-amber-900 dark:text-amber-200"
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
    <div className="p-3 border-b border-border/40 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          data-testid="library-search"
          placeholder={t('search')}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
          }}
          className="flex-1 rounded-md border border-border bg-field px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          data-testid="library-insert-image"
          disabled={!hasSelection}
          onClick={onOpenImagePicker}
          className="rounded-md border border-border bg-field px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-field-hover disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
        >
          {t('insertImage', 'Ảnh…')}
        </button>
      </div>

      <LibraryStatusHint hasSelection={hasSelection} errorInfo={errorInfo} />
    </div>
  );
}
