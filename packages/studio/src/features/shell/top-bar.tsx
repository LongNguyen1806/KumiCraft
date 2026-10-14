import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../../app/language-switcher.tsx';
import { SettingsButton } from '../settings/settings-button.tsx';

type TopBarProps = {
  readonly version?: string;
  readonly children?: ReactNode;
};

/** Brand pill, screen-specific controls, version and language: the top row of every screen. */
export function TopBar({ version, children }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center gap-2.5">
      <div className="flex h-10 items-center gap-2 rounded-full border-[1.5px] border-charcoal px-[18px] text-[17px] tracking-tight">
        {t('app.name')}
      </div>
      {children}
      <div className="flex-1" />
      {version !== undefined && (
        <span className="font-mono text-xs text-ink-faint" data-testid="studio-version">
          {t('app.version', { version })}
        </span>
      )}
      <LanguageSwitcher />
      <SettingsButton />
    </header>
  );
}
