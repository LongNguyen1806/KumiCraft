// A folder anywhere on this computer: typed, or picked with Browse… (absolute path).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DirectoryBrowser } from './directory-browser.tsx';

export type FolderFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (path: string) => void;
  readonly placeholder?: string | undefined;
  /** Where Browse… starts while the field is empty. */
  readonly startPath?: string | undefined;
  /** Test id of the input; the button gets `<testId>-browse`. */
  readonly testId: string;
};

export function FolderField({
  label,
  value,
  onChange,
  placeholder,
  startPath,
  testId,
}: FolderFieldProps) {
  const { t } = useTranslation();
  const [browsing, setBrowsing] = useState(false);
  return (
    <div className="grid gap-1">
      <span className="text-[11px] text-ink-faint">{label}</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          aria-label={label}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="min-w-0 flex-1 rounded border border-border bg-field px-2.5 py-1.5 font-mono text-xs text-ink focus:outline-none"
          data-testid={testId}
        />
        <button
          type="button"
          onClick={() => {
            setBrowsing(!browsing);
          }}
          className="shrink-0 cursor-pointer rounded-full bg-field px-4 py-1.5 text-xs font-medium text-ink hover:bg-field-hover"
          data-testid={`${testId}-browse`}
        >
          {browsing ? t('project.browseDone') : t('project.browse')}
        </button>
      </div>
      {browsing && (
        <DirectoryBrowser
          currentPath={value === '' ? (startPath ?? '') : value}
          onSelectPath={onChange}
        />
      )}
    </div>
  );
}
