import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsIcon } from '../../components/ui/icons.tsx';
import { SettingsDialog } from './settings-dialog.tsx';

export type SettingsButtonProps = {
  readonly variant?: 'round' | 'activity';
  readonly testId?: string | undefined;
};

/** The round gear button of the top bars; it opens the Settings dialog. */
export function SettingsButton({ variant = 'round', testId }: SettingsButtonProps = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isActivity = variant === 'activity';
  return (
    <>
      <button
        type="button"
        data-testid={testId ?? (isActivity ? 'activity-settings' : undefined)}
        aria-label={t('settings.open')}
        title={t('settings.open')}
        onClick={() => {
          setOpen(true);
        }}
        className={
          isActivity
            ? 'relative flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-field hover:text-ink'
            : 'grid size-10 place-items-center rounded-full bg-card text-ink shadow-soft backdrop-blur-md transition-transform hover:-translate-y-px'
        }
      >
        <SettingsIcon />
      </button>
      <SettingsDialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
