// One control per kind of knob (thiet-ke-component.md §3): a field for text, a switch on the same
// row for yes/no, a row of buttons for two to four choices, a list for more, the code of a value
// that comes from the code with a button to open it.
import type { ComponentPropSpec, SetPropValue } from '@kumicraft/shared';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { optionLabel, propLabel } from './prop-labels.ts';
import { ImageField, PageSuggestions } from './prop-pickers.tsx';

export type PropControlProps = {
  readonly spec: ComponentPropSpec;
  readonly disabled: boolean;
  readonly onChange: (val: SetPropValue | undefined) => void;
  readonly onOpenEditor: () => void;
};

const FIELD = 'h-7 w-full min-w-0 rounded-md border border-line bg-field px-2 text-xs text-ink';

function defaultHint(spec: ComponentPropSpec, t: (k: 'componentProps.default') => string) {
  const shown = spec.defaultValue === undefined ? '' : `: ${String(spec.defaultValue)}`;
  return `${t('componentProps.default')}${shown}`;
}

export function PropName({ spec }: { readonly spec: ComponentPropSpec }) {
  const { i18n } = useTranslation();
  const words = propLabel(spec.name, i18n.language);
  return (
    <span className="flex min-w-0 flex-col">
      <span className={words === undefined ? 'font-mono text-[11px] text-ink' : 'text-xs text-ink'}>
        {words ?? spec.name}
      </span>
      {words !== undefined && (
        <span className="font-mono text-[10px] leading-tight text-ink-faint">{spec.name}</span>
      )}
    </span>
  );
}

/** A value written as code (`{item.image}`): shown, opened, or swapped for a fixed value. */
function FromCodeControl({
  spec,
  disabled,
  onOpenEditor,
  onFix,
}: PropControlProps & { readonly onFix: () => void }) {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex min-w-0 items-center gap-1">
        <code
          data-testid={`prop-readonly-${spec.name}`}
          className="min-w-0 flex-1 truncate rounded-md border border-dashed border-line bg-field px-2 py-1 font-mono text-[11px] text-ink-soft"
          title={spec.expression}
        >
          {spec.expression ?? '…'}
        </code>
        <button
          type="button"
          onClick={onOpenEditor}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-line px-1.5 py-1 text-[11px] text-ink hover:bg-field"
        >
          <ExternalLink className="size-3" aria-hidden />
          {t('componentProps.openEditor')}
        </button>
      </span>
      <span className="flex items-center gap-1 text-[10px] text-ink-faint">
        {t('componentProps.fromCode')}
        {spec.kind !== 'complex' && (
          <>
            {' · '}
            <button
              type="button"
              data-testid={`prop-fix-${spec.name}`}
              disabled={disabled}
              onClick={onFix}
              className="text-accent hover:underline disabled:opacity-50"
            >
              {t('componentProps.fixValue')}
            </button>
          </>
        )}
      </span>
    </span>
  );
}

function SwitchControl({ spec, disabled, onChange }: PropControlProps) {
  const on = spec.value === true || (spec.value === undefined && spec.defaultValue === true);
  return (
    <input
      type="checkbox"
      role="switch"
      data-testid={`prop-input-${spec.name}`}
      aria-label={spec.name}
      checked={on}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.checked);
      }}
      className="relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-4 before:rounded-full before:bg-card-solid before:shadow-sm before:transition-transform checked:bg-accent checked:before:translate-x-4 disabled:cursor-default disabled:opacity-50"
    />
  );
}

/** Two to four choices: buttons in a row; picking the chosen one again goes back to the default. */
function ChoiceRow({ spec, disabled, onChange }: PropControlProps) {
  const { i18n } = useTranslation();
  const current = typeof spec.value === 'string' ? spec.value : spec.defaultValue;
  return (
    <div
      role="radiogroup"
      aria-label={spec.name}
      data-testid={`prop-input-${spec.name}`}
      className="flex min-w-0 gap-0.5 rounded-md border border-line bg-field p-0.5"
    >
      {(spec.options ?? []).map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={current === opt}
          data-testid={`prop-option-${spec.name}-${opt}`}
          disabled={disabled}
          onClick={() => {
            const again = spec.value === opt && !spec.required;
            onChange(again ? undefined : opt);
          }}
          className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-[11px] text-ink-soft aria-checked:bg-card-solid aria-checked:font-medium aria-checked:text-ink aria-checked:shadow-sm"
        >
          {optionLabel(opt, i18n.language)}
        </button>
      ))}
    </div>
  );
}

function ChoiceList({ spec, disabled, onChange }: PropControlProps) {
  const { t, i18n } = useTranslation();
  return (
    <select
      data-testid={`prop-input-${spec.name}`}
      aria-label={spec.name}
      value={typeof spec.value === 'string' ? spec.value : ''}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value === '' ? undefined : e.target.value);
      }}
      className={FIELD}
    >
      {!spec.required && <option value="">{defaultHint(spec, t)}</option>}
      {(spec.options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          {optionLabel(opt, i18n.language)}
        </option>
      ))}
    </select>
  );
}

/** Text and numbers are written when the field is left or Enter is pressed, not on each key. */
function TypedField({
  spec,
  disabled,
  onChange,
  listId,
}: PropControlProps & { readonly listId?: string | undefined }) {
  const { t } = useTranslation();
  const isNumber = spec.kind === 'number';
  const saved =
    typeof spec.value === 'string' || typeof spec.value === 'number' ? String(spec.value) : '';
  const [draft, setDraft] = useState<{ base: string; text: string }>({ base: saved, text: saved });
  const text = draft.base === saved ? draft.text : saved;
  const commit = () => {
    const raw = text.trim();
    if (raw === saved) return;
    if (raw === '') onChange(undefined);
    else if (!isNumber) onChange(text);
    else if (Number.isFinite(Number(raw))) onChange(Number(raw));
  };
  return (
    <input
      type={isNumber ? 'number' : 'text'}
      data-testid={`prop-input-${spec.name}`}
      aria-label={spec.name}
      value={text}
      placeholder={defaultHint(spec, t)}
      list={listId}
      disabled={disabled}
      onChange={(e) => {
        setDraft({ base: saved, text: e.target.value });
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
      }}
      className={FIELD}
    />
  );
}

function LinkField(props: PropControlProps) {
  const listId = `prop-pages-${props.spec.name}`;
  return (
    <>
      <TypedField {...props} listId={listId} />
      <PageSuggestions id={listId} />
    </>
  );
}

export function PropControl(props: PropControlProps) {
  // "Set a fixed value" turns a value from the code into an ordinary field, written over it.
  const [fixed, setFixed] = useState(false);
  const spec =
    fixed && props.spec.readonlyExpression
      ? { ...props.spec, readonlyExpression: false, value: undefined }
      : props.spec;
  const shown = { ...props, spec };
  const isText = spec.kind === 'string';
  if (spec.role === 'image' && isText) return <ImageField {...shown} />;
  if (spec.readonlyExpression || spec.kind === 'complex') {
    return (
      <FromCodeControl
        {...shown}
        onFix={() => {
          setFixed(true);
        }}
      />
    );
  }
  if (spec.role === 'link' && isText) return <LinkField {...shown} />;
  if (spec.kind === 'boolean') return <SwitchControl {...shown} />;
  if (spec.kind === 'union' && spec.options !== undefined) {
    return spec.options.length <= 4 ? <ChoiceRow {...shown} /> : <ChoiceList {...shown} />;
  }
  return <TypedField {...shown} />;
}
