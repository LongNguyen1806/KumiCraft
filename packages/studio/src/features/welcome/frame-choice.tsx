import { FRAME_PRESETS, type FramePreset } from '@reactcraft/model';
import { useTranslation } from 'react-i18next';

import { ChoicePill } from '../../components/ui/choice-pill.tsx';
import {
  type FrameChoice as Choice,
  framesOf,
  type WelcomeValues,
} from './use-create-workspace-form.ts';

const PRESETS = Object.keys(FRAME_PRESETS) as FramePreset[];

type FrameChoiceProps = {
  readonly values: WelcomeValues;
  readonly hasError: boolean;
  readonly onChange: (patch: Partial<WelcomeValues>) => void;
};

/** Primary frame: a standard size or a custom one, with the frames the workspace will get. */
export function FrameChoice({ values, hasError, onChange }: FrameChoiceProps) {
  const { t } = useTranslation();
  const customLabel = t('welcome.form.custom');
  const pick = (frame: Choice) => () => {
    onChange({ frame });
  };
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-2 text-ink-soft">{t('welcome.form.frame')}</legend>
      <div className="flex flex-wrap gap-1 rounded-3xl bg-field p-1">
        {PRESETS.map((preset) => (
          <ChoicePill
            key={preset}
            name="frame"
            value={preset}
            checked={values.frame === preset}
            onChange={pick(preset)}
          >
            {FRAME_PRESETS[preset].label}
            <span className="font-mono text-xs opacity-60">{FRAME_PRESETS[preset].width}</span>
          </ChoicePill>
        ))}
        <ChoicePill
          name="frame"
          value="custom"
          checked={values.frame === 'custom'}
          onChange={pick('custom')}
        >
          {customLabel}
        </ChoicePill>
      </div>
      {values.frame === 'custom' && (
        <CustomSize values={values} hasError={hasError} onChange={onChange} />
      )}
      <FramesPreview values={values} customLabel={customLabel} />
    </fieldset>
  );
}

/** The frames the workspace will get, primary first (highlighted). */
function FramesPreview({
  values,
  customLabel,
}: {
  readonly values: WelcomeValues;
  readonly customLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <p
      className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-ink-faint"
      data-testid="frames-preview"
    >
      {t('welcome.form.framesPreview')}
      {framesOf(values, customLabel).map((frame, index) => (
        <span
          key={frame.id}
          className={
            index === 0
              ? 'rounded-full bg-sun-soft px-2.5 py-0.5 text-ink'
              : 'rounded-full bg-field px-2.5 py-0.5 text-ink-soft'
          }
        >
          {t('welcome.form.frameItem', {
            label: frame.label,
            width: frame.width,
            height: frame.height,
          })}
        </span>
      ))}
    </p>
  );
}

function CustomSize({ values, hasError, onChange }: FrameChoiceProps) {
  const { t } = useTranslation();
  const input =
    'h-9 w-24 rounded-xl border border-transparent bg-field px-3 font-mono text-xs focus:border-charcoal focus:bg-card-solid focus:outline-none';
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-ink-soft">
          {t('welcome.form.width')}
          <input
            type="number"
            className={input}
            value={values.customWidth}
            aria-invalid={hasError}
            onChange={(event) => {
              onChange({ customWidth: Number(event.target.value) });
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-ink-soft">
          {t('welcome.form.height')}
          <input
            type="number"
            className={input}
            value={values.customHeight}
            aria-invalid={hasError}
            onChange={(event) => {
              onChange({ customHeight: Number(event.target.value) });
            }}
          />
        </label>
      </div>
      {hasError && <p className="text-xs text-danger">{t('welcome.form.errors.frameSize')}</p>}
    </div>
  );
}
