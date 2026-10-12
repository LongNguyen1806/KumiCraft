import type { ResponsiveMode } from '@reactcraft/model';
import { useTranslation } from 'react-i18next';

const MODES = [
  { mode: 'desktop-first', key: 'desktopFirst' },
  { mode: 'mobile-first', key: 'mobileFirst' },
] as const;

type ModeChoiceProps = {
  readonly value: ResponsiveMode;
  readonly onChange: (mode: ResponsiveMode) => void;
};

/** Desktop-first or mobile-first, each with a one-line explanation (SPEC-04.1 section 6.1). */
export function ModeChoice({ value, onChange }: ModeChoiceProps) {
  const { t } = useTranslation();
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-2 text-ink-soft">{t('welcome.form.mode')}</legend>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map(({ mode, key }) => (
          <label
            key={mode}
            className="grid cursor-pointer gap-1 rounded-2xl border border-line bg-card-solid p-3.5 transition-colors hover:border-ink-faint has-checked:border-charcoal has-checked:shadow-[inset_0_0_0_1px_var(--color-charcoal)] has-focus-visible:outline-2 has-focus-visible:outline-charcoal"
          >
            <input
              type="radio"
              className="sr-only"
              name="mode"
              value={mode}
              checked={value === mode}
              onChange={() => {
                onChange(mode);
              }}
            />
            <span className="font-medium">{t(`welcome.form.${key}`)}</span>
            <span className="text-xs text-ink-soft">{t(`welcome.form.${key}Help`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
