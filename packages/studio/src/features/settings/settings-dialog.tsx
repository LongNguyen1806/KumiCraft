import { useTranslation } from 'react-i18next';

import { ChoicePill } from '../../components/ui/choice-pill.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { LANGUAGES } from '../../i18n/i18n.ts';
import { errorText } from '../../routes/error-text.ts';
import { useSettingsStore } from '../../store/settings-store.ts';

type SettingsDialogProps = { readonly open: boolean; readonly onClose: () => void };

/**
 * Settings (SPEC-04.1 section 6, SPEC-03 section 10.2): interface language and export checks.
 * Changes apply at once and are remembered for every workspace on this computer. The AI section
 * comes with the `ai` feature (Phase 2).
 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const exports = settings?.export ?? { typecheck: true, buildCheck: false };
  const isUnavailable = settings === undefined;

  return (
    <Dialog
      open={open}
      title={t('settings.title')}
      closeLabel={t('settings.close')}
      onClose={onClose}
    >
      <Section title={t('settings.interface')}>
        <LanguageChoice />
      </Section>
      <Section title={t('settings.export')} note={t('settings.exportLater')}>
        <Switch
          label={t('settings.typecheck')}
          help={t('settings.typecheckHelp')}
          checked={exports.typecheck}
          disabled={isUnavailable}
          onChange={(typecheck) => void update({ export: { typecheck } })}
        />
        <Switch
          label={t('settings.buildCheck')}
          help={t('settings.buildCheckHelp')}
          checked={exports.buildCheck}
          disabled={isUnavailable}
          onChange={(buildCheck) => void update({ export: { buildCheck } })}
        />
      </Section>
      <SaveStatus />
    </Dialog>
  );
}

/** Interface language: switches at once and is remembered (ADR-FE-16). */
function LanguageChoice() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  return (
    <fieldset className="grid gap-2 py-2.5">
      <legend className="pb-2 font-medium">{t('settings.language')}</legend>
      <div className="flex gap-1 justify-self-start rounded-full bg-field p-1">
        {LANGUAGES.map((language) => (
          <ChoicePill
            key={language}
            name="interface-language"
            value={language}
            checked={i18n.resolvedLanguage === language}
            onChange={() => {
              void setLanguage(language);
            }}
          >
            {t(`language.${language}`)}
          </ChoicePill>
        ))}
      </div>
      <span className="text-xs text-ink-soft">{t('settings.languageHelp')}</span>
    </fieldset>
  );
}

function Section({
  title,
  note,
  children,
}: {
  readonly title: string;
  readonly note?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border-t border-dashed border-line pt-3 first-of-type:border-t-0">
      <h3 className="text-ink-faint">{title}</h3>
      {note !== undefined && <p className="text-xs text-ink-faint">{note}</p>}
      {children}
    </section>
  );
}

/** "Saved", or why the last change could not be saved (it was undone). */
function SaveStatus() {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  const save = useSettingsStore((state) => state.save);
  if (save.status === 'failed') {
    return (
      <p role="alert" className="pt-2 text-danger">
        {errorText(tError, save.code)}
      </p>
    );
  }
  return (
    <p role="status" className="min-h-5 pt-2 text-xs text-ink-faint">
      {save.status === 'idle' ? '' : t(`settings.${save.status}`)}
    </p>
  );
}
