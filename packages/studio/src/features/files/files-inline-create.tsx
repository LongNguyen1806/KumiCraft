import { Folder } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText, toErrorInfo } from '../../routes/error-text.ts';

/**
 * Checks a typed name, sends it, and turns a server refusal (name taken, folder too large…) into
 * the message under the input. Shared by the create and rename inputs.
 */
export function useNameCommit(onCommit: (name: string) => Promise<void>) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const [error, setError] = useState<string | undefined>();
  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || /[:*?"<>|\\]/.test(trimmed)) {
      setError(t('files.invalidName'));
      return;
    }
    onCommit(trimmed).catch((failure: unknown) => {
      const info = toErrorInfo(failure);
      setError(errorText(tError, info.code, info.params));
    });
  };
  return { error, setError, submit };
}

export function useInlineCreateState(
  onCommit: (name: string) => Promise<void>,
  onCancel: () => void,
) {
  const [val, setVal] = useState('');
  const { error, setError, submit } = useNameCommit(onCommit);
  const inputRef = useRef<HTMLInputElement | undefined>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    else if (e.key === 'Enter') submit(val);
  };

  return { val, setVal, error, setError, inputRef, handleKeyDown };
}

export type InlineCreateRowProps = {
  readonly action: { readonly kind: 'newFile' | 'newFolder'; readonly dir: string };
  readonly onCommit: (name: string) => Promise<void>;
  readonly onCancel: () => void;
};

export function InlineCreateRow({ action, onCommit, onCancel }: InlineCreateRowProps) {
  const { t } = useTranslation();
  const { val, setVal, error, setError, inputRef, handleKeyDown } = useInlineCreateState(
    onCommit,
    onCancel,
  );
  const isFolder = action.kind === 'newFolder';
  const level = action.dir ? action.dir.split('/').length : 0;

  return (
    <div
      style={{ paddingLeft: `${String(level * 14 + 6)}px` }}
      className="flex flex-col gap-0.5 py-1 pr-1.5"
    >
      <div className="flex items-center gap-1.5">
        {isFolder ? (
          <Folder className="size-3.5 shrink-0 text-amber-500" />
        ) : (
          <div className="size-3.5 shrink-0" />
        )}
        <input
          ref={(el) => {
            inputRef.current = el ?? undefined;
          }}
          data-testid="files-inline-create-input"
          type="text"
          value={val}
          placeholder={t('files.namePlaceholder')}
          onChange={(e) => {
            setVal(e.target.value);
            if (error !== undefined) setError(undefined);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded border border-accent bg-card-solid px-1.5 py-0.5 text-xs text-ink"
        />
      </div>
      {error !== undefined && (
        <span data-testid="files-inline-create-error" className="text-[10px] text-danger pl-5">
          {error}
        </span>
      )}
    </div>
  );
}
