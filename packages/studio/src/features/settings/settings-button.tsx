import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsIcon } from '../../components/ui/icons.tsx';
import { SettingsDialog } from './settings-dialog.tsx';

/** The round gear button of the top bars; it opens the Settings dialog. */
export function SettingsButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t('settings.open')}
        title={t('settings.open')}
        onClick={() => {
          setOpen(true);
        }}
        className="grid size-10 place-items-center rounded-full bg-card text-ink shadow-soft backdrop-blur-md transition-transform hover:-translate-y-px"
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
