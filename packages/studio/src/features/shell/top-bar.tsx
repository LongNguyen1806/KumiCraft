import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsButton } from '../settings/settings-button.tsx';

type TopBarProps = {
  readonly version?: string;
  readonly children?: ReactNode;
};

/** The top row outside the Editor: brand, screen controls, version and Settings. */
export function TopBar({ version, children }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-card-solid px-2.5">
      <div className="flex h-[30px] items-center gap-2 rounded-md border border-line pr-2.5 pl-1.5 text-[13px] font-semibold">
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-[5px] bg-sun text-[11px] font-bold text-on-sun"
        >
          K
        </span>
        <span>{t('app.name')}</span>
      </div>
      {children}
      <div className="flex-1" />
      {version !== undefined && (
        <span className="font-mono text-xs text-ink-faint" data-testid="studio-version">
          {t('app.version', { version })}
        </span>
      )}
      <SettingsButton />
    </header>
  );
}
