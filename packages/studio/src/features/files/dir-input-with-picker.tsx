import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FolderPicker } from './folder-picker.tsx';

export type DirInputWithPickerProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean | undefined;
  readonly placeholder?: string | undefined;
  readonly dataTestId?: string | undefined;
  readonly className?: string | undefined;
};

export function DirInputWithPicker({
  value,
  onChange,
  disabled,
  placeholder,
  dataTestId,
  className,
}: DirInputWithPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <input
        data-testid={dataTestId}
        type="text"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="min-w-0 flex-1 h-7 rounded-md border border-line bg-card-solid px-2 text-xs text-ink disabled:opacity-50"
      />
      <button
        type="button"
        title={t('files.pickFolder')}
        data-testid={dataTestId ? `${dataTestId}-pick-btn` : undefined}
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
        className="shrink-0 rounded border border-border bg-button px-2 py-1 text-xs text-ink hover:bg-field disabled:opacity-50"
      >
        {t('files.select')}…
      </button>
      {open && (
        <FolderPicker
          open={open}
          mode="folder"
          initial={value}
          onPick={onChange}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
