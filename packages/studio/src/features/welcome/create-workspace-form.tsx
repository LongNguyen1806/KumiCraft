import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ChoicePill } from '../../components/ui/choice-pill.tsx';
import { errorText } from '../../routes/error-text.ts';
import { FrameChoice } from './frame-choice.tsx';
import { ModeChoice } from './mode-choice.tsx';
import {
  type DarkMode,
  fieldErrors,
  toRequest,
  useCreateWorkspaceForm,
  type WelcomeValues,
} from './use-create-workspace-form.ts';

const LOCALES = ['vi-VN', 'en-US'] as const;
const DARK_MODES: readonly DarkMode[] = ['none', 'media', 'class'];

/** Creates the workspace (`POST /workspace`); `onCreated` reads the session again. */
export function CreateWorkspaceForm({ onCreated }: { readonly onCreated: () => void }) {
  const { t, i18n } = useTranslation();
  const form = useCreateWorkspaceForm(
    i18n.resolvedLanguage === 'vi' ? 'vi-VN' : 'en-US',
    onCreated,
  );
  const request = toRequest(form.values, t('welcome.form.custom'));
  const errors = form.showErrors ? fieldErrors(request) : [];

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.send(request);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-5 rounded-panel bg-card p-7 shadow-soft backdrop-blur-xl"
    >
      <NameField
        value={form.values.name}
        hasError={errors.includes('name')}
        onChange={(name) => {
          form.update({ name });
        }}
      />
      <ModeChoice
        value={form.values.mode}
        onChange={(mode) => {
          form.update({ mode });
        }}
      />
      <FrameChoice
        values={form.values}
        hasError={errors.includes('frame')}
        onChange={form.update}
      />
      <LocaleField
        value={form.values.contentLocale}
        onChange={(contentLocale) => {
          form.update({ contentLocale });
        }}
      />
      <AdvancedOptions values={form.values} onChange={form.update} />
      <SubmitRow
        isSending={form.submit.status === 'sending'}
        {...(form.submit.status === 'failed' ? { failedCode: form.submit.code } : {})}
      />
    </form>
  );
}

function SubmitRow({
  isSending,
  failedCode,
}: {
  readonly isSending: boolean;
  readonly failedCode?: string;
}) {
  const { t } = useTranslation();
  const { t: tError } = useTranslation('errors');
  return (
    <>
      {failedCode !== undefined && (
        <p role="alert" className="text-danger">
          {errorText(tError, failedCode)}
        </p>
      )}
      <button
        type="submit"
        disabled={isSending}
        className="h-11 justify-self-start rounded-full bg-sun px-6 font-medium text-ink transition-opacity disabled:opacity-60"
      >
        {isSending ? t('welcome.form.submitting') : t('welcome.form.submit')}
      </button>
    </>
  );
}

type FieldProps<T> = { readonly value: T; readonly onChange: (value: T) => void };

function NameField({
  value,
  hasError,
  onChange,
}: FieldProps<string> & { readonly hasError: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-1.5">
      <label htmlFor="workspace-name" className="text-ink-soft">
        {t('welcome.form.name')}
      </label>
      <input
        id="workspace-name"
        value={value}
        maxLength={64}
        placeholder={t('welcome.form.namePlaceholder')}
        aria-invalid={hasError}
        aria-describedby={hasError ? 'workspace-name-error' : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-11 rounded-2xl border border-transparent bg-field px-4 text-base placeholder:text-ink-faint focus:border-charcoal focus:bg-card-solid focus:outline-none aria-invalid:border-danger"
      />
      {hasError && (
        <p id="workspace-name-error" className="text-xs text-danger">
          {t('welcome.form.errors.name')}
        </p>
      )}
    </div>
  );
}

function LocaleField({ value, onChange }: FieldProps<string>) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-1.5">
      <label htmlFor="content-locale" className="text-ink-soft">
        {t('welcome.form.locale')}
      </label>
      <select
        id="content-locale"
        value={value}
        aria-describedby="content-locale-help"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="h-10 justify-self-start rounded-full bg-field pr-8 pl-4"
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {t(`welcome.form.locales.${locale}`)}
          </option>
        ))}
      </select>
      <p id="content-locale-help" className="text-xs text-ink-faint">
        {t('welcome.form.localeHelp')}
      </p>
    </div>
  );
}

type AdvancedOptionsProps = {
  readonly values: WelcomeValues;
  readonly onChange: (patch: Partial<WelcomeValues>) => void;
};

function AdvancedOptions({ values, onChange }: AdvancedOptionsProps) {
  const { t } = useTranslation();
  return (
    <details className="border-t border-dashed border-line pt-3">
      <summary className="cursor-pointer text-ink-soft select-none">
        {t('welcome.form.advanced')}
      </summary>
      <fieldset className="grid gap-2 pt-3">
        <legend className="pb-2 text-ink-soft">{t('welcome.form.darkMode')}</legend>
        <div className="flex flex-wrap gap-1 justify-self-start rounded-full bg-field p-1">
          {DARK_MODES.map((mode) => (
            <ChoicePill
              key={mode}
              name="dark-mode"
              value={mode}
              checked={values.darkMode === mode}
              onChange={() => {
                onChange({ darkMode: mode });
              }}
            >
              {t(`welcome.form.dark.${mode}`)}
            </ChoicePill>
          ))}
        </div>
      </fieldset>
    </details>
  );
}
