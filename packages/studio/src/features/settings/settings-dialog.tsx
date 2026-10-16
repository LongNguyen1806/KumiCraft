import { useTranslation } from 'react-i18next';

import { EDITORS, PACKAGE_MANAGERS } from '../../api/settings-client.ts';
import { ChoicePill } from '../../components/ui/choice-pill.tsx';
import { Dialog } from '../../components/ui/dialog.tsx';
import { LANGUAGES } from '../../i18n/i18n.ts';
import { errorText } from '../../routes/error-text.ts';
import { useSettingsStore } from '../../store/settings-store.ts';

type SettingsDialogProps = { readonly open: boolean; readonly onClose: () => void };

/**
 * Settings (SPEC-03 section 5.2): interface language, the editor that opens source files and the
 * package manager for new projects. Changes apply at once and are remembered for every project on
 * this computer. The agent choice comes with the `ai` feature (Phase 3).
 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation();
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
      <Section title={t('settings.tools')}>
        <EditorChoice />
        <PackageManagerChoice />
      </Section>
      <SaveStatus />
    </Dialog>
  );
}

/** The editor that "Open in editor" starts (SPEC-03 section 5.2). */
function EditorChoice() {
  const { t } = useTranslation();
  const editor = useSettingsStore((state) => state.settings?.editor);
  const update = useSettingsStore((state) => state.update);
  return (
    <fieldset className="grid min-w-0 gap-2 py-2.5" disabled={editor === undefined}>
      <legend className="pb-2 font-medium">{t('settings.editor')}</legend>
      <div className="flex flex-wrap gap-1 justify-self-start rounded-full bg-field p-1">
        {EDITORS.map((value) => (
          <ChoicePill
            key={value}
            name="editor"
            value={value}
            checked={editor === value}
            onChange={() => void update({ editor: value })}
          >
            {t(`settings.editors.${value}`)}
          </ChoicePill>
        ))}
      </div>
      <span className="text-xs text-ink-soft">{t('settings.editorHelp')}</span>
    </fieldset>
  );
}

/** Package manager used to install a new project; an existing project keeps its own. */
function PackageManagerChoice() {
  const { t } = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  return (
    <fieldset className="grid min-w-0 gap-2 py-2.5" disabled={settings === undefined}>
      <legend className="pb-2 font-medium">{t('settings.packageManager')}</legend>
      <div className="flex gap-1 justify-self-start rounded-full bg-field p-1">
        {PACKAGE_MANAGERS.map((value) => (
          <ChoicePill
            key={value}
            name="package-manager"
            value={value}
            checked={settings?.packageManager === value}
            onChange={() => void update({ packageManager: value })}
          >
            {value}
          </ChoicePill>
        ))}
      </div>
      <span className="text-xs text-ink-soft">{t('settings.packageManagerHelp')}</span>
    </fieldset>
  );
}

/** Interface language: switches at once and is remembered (ADR-FE-16). */
function LanguageChoice() {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  return (
    <fieldset className="grid min-w-0 gap-2 py-2.5">
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
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border-t border-dashed border-line pt-3 first-of-type:border-t-0">
      <h3 className="text-ink-faint">{title}</h3>
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
        {errorText(tError, save.info.code, save.info.params)}
      </p>
    );
  }
  return (
    <p role="status" className="min-h-5 pt-2 text-xs text-ink-faint">
      {save.status === 'idle' ? '' : t(`settings.${save.status}`)}
    </p>
  );
}
