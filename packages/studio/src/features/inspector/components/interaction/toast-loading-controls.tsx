// Toast trigger and LoadingButton conversion controls (K9.8-1 TK-76, TK-77).
import type { ElementSource, ToastPosition, ToastVariant } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyInteraction } from '../../../../api/interaction-client.ts';
import {
  interactionDisableReason,
  InteractionErrorNotice,
  ToolActionButton,
  useInteractionTask,
} from './interaction-shared.tsx';

export const TOAST_ELIGIBLE_TAGS = new Set(['button', 'a', 'Link', 'LoadingButton', 'SelectItem']);
export const LOADING_ELIGIBLE_TAGS = new Set(['button', 'a', 'LoadingButton']);

const TOAST_DURATIONS = [3000, 4000, 5000] as const;

function ToastPositionSelect({
  value,
  onChange,
}: {
  readonly value: ToastPosition;
  readonly onChange: (p: ToastPosition) => void;
}) {
  const { t } = useTranslation();
  return (
    <select
      data-testid="toast-position-select"
      value={value}
      onChange={(e) => {
        const p = e.target.value;
        if (p === 'bottom-right' || p === 'bottom-left' || p === 'top-right' || p === 'top-center')
          onChange(p);
      }}
      className="h-[24px] rounded border border-line bg-card-solid px-1 text-[10px] text-ink"
    >
      <option value="bottom-right">{t('interaction.posBottomRight')}</option>
      <option value="bottom-left">{t('interaction.posBottomLeft')}</option>
      <option value="top-right">{t('interaction.posTopRight')}</option>
      <option value="top-center">{t('interaction.posTopCenter')}</option>
    </select>
  );
}

function ToastOptionsRow({
  variant,
  durationMs,
  position,
  onVariant,
  onDuration,
  onPosition,
}: {
  readonly variant: ToastVariant;
  readonly durationMs: number;
  readonly position: ToastPosition;
  readonly onVariant: (v: ToastVariant) => void;
  readonly onDuration: (d: number) => void;
  readonly onPosition: (p: ToastPosition) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-1">
      <select
        data-testid="toast-variant-select"
        value={variant}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'success' || v === 'error' || v === 'info') onVariant(v);
        }}
        className="h-[24px] rounded border border-line bg-card-solid px-1 text-[10px] text-ink"
      >
        <option value="success">{t('interaction.toastSuccess')}</option>
        <option value="error">{t('interaction.toastError')}</option>
        <option value="info">{t('interaction.toastInfo')}</option>
      </select>
      <select
        data-testid="toast-duration-select"
        value={String(durationMs)}
        onChange={(e) => {
          onDuration(Number(e.target.value));
        }}
        className="h-[24px] rounded border border-line bg-card-solid px-1 text-[10px] text-ink"
      >
        {TOAST_DURATIONS.map((ms) => (
          <option key={ms} value={String(ms)}>
            {t('interaction.secondsShort', { count: ms / 1000 })}
          </option>
        ))}
      </select>
      <ToastPositionSelect value={position} onChange={onPosition} />
    </div>
  );
}

type ToastFormValues = {
  readonly message: string;
  readonly subtext: string;
  readonly variant: ToastVariant;
  readonly durationMs: number;
  readonly position: ToastPosition;
};

type ToastConfigFormProps = {
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly aiPrompt?: string | undefined;
  readonly onSubmit: (opts: ToastFormValues) => void;
};

function ToastTextInput({
  testId,
  placeholder,
  value,
  onChange,
}: {
  readonly testId: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  return (
    <input
      type="text"
      data-testid={testId}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className="h-[26px] rounded border border-line bg-card-solid px-2 text-[11px] text-ink"
    />
  );
}

function ToastConfigForm({ busy, error, aiPrompt, onSubmit }: ToastConfigFormProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [subtext, setSubtext] = useState('');
  const [variant, setVariant] = useState<ToastVariant>('success');
  const [durationMs, setDurationMs] = useState(4000);
  const [position, setPosition] = useState<ToastPosition>('bottom-right');

  return (
    <div className="flex flex-col gap-1.5 rounded border border-line bg-field/60 p-2">
      <ToastTextInput
        testId="toast-message-input"
        placeholder={t('interaction.toastMessagePlaceholder')}
        value={message}
        onChange={setMessage}
      />
      <ToastTextInput
        testId="toast-subtext-input"
        placeholder={t('interaction.toastSubtextPlaceholder')}
        value={subtext}
        onChange={setSubtext}
      />
      <ToastOptionsRow
        variant={variant}
        durationMs={durationMs}
        position={position}
        onVariant={setVariant}
        onDuration={setDurationMs}
        onPosition={setPosition}
      />
      <ToolActionButton
        testId="apply-toast-on-click"
        label={t('interaction.applyToast')}
        tooltip={t('interaction.toastOnClickTooltip')}
        variant="primary"
        disabled={message.trim() === ''}
        busy={busy}
        onClick={() => {
          onSubmit({ message, subtext, variant, durationMs, position });
        }}
      />
      <InteractionErrorNotice error={error} aiPrompt={aiPrompt} />
    </div>
  );
}

type InteractionControlProps = {
  readonly source: ElementSource;
  readonly onDone: () => void;
};

export function ToastOnClickControl({ source, onDone }: InteractionControlProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { busy, error, aiPrompt, run } = useInteractionTask(() => {
    setExpanded(false);
    onDone();
  });

  if (!TOAST_ELIGIBLE_TAGS.has(source.tag)) return undefined;
  const reasonKey = interactionDisableReason(source);
  const disabledReason =
    reasonKey !== undefined ? t(`interaction.reasons.${reasonKey}`) : undefined;

  const submitToast = (opts: ToastFormValues) => {
    if (opts.message.trim() === '') return;
    void run(
      () =>
        applyInteraction({
          action: 'addToastOnClick',
          element: { loc: source.loc, tag: source.tag },
          message: opts.message.trim(),
          ...(opts.subtext.trim() !== '' ? { subtext: opts.subtext.trim() } : {}),
          variant: opts.variant,
          durationMs: opts.durationMs,
          position: opts.position,
        }),
      { message: opts.message.trim(), loc: source.loc },
    );
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-line/60 pt-1.5">
      <ToolActionButton
        testId="open-toast-config-btn"
        label={t('interaction.toastOnClick')}
        tooltip={t('interaction.toastOnClickTooltip')}
        disabledReason={disabledReason}
        onClick={() => {
          setExpanded((v) => !v);
        }}
      />
      {expanded && (
        <ToastConfigForm busy={busy} error={error} aiPrompt={aiPrompt} onSubmit={submitToast} />
      )}
    </div>
  );
}

function getLoadingReasonKey(
  source: ElementSource,
): 'alreadyLoadingButton' | 'onlyButtonTag' | 'readonly' | 'insideLoop' | undefined {
  if (source.tag === 'LoadingButton') return 'alreadyLoadingButton';
  if (source.tag === 'a') return 'onlyButtonTag';
  return interactionDisableReason(source);
}

export function LoadingButtonControl({ source, onDone }: InteractionControlProps) {
  const { t } = useTranslation();
  const [loadingText, setLoadingText] = useState('');
  const { busy, error, run } = useInteractionTask(onDone);

  if (!LOADING_ELIGIBLE_TAGS.has(source.tag)) return undefined;
  const reasonKey = getLoadingReasonKey(source);
  const disabledReason =
    reasonKey !== undefined ? t(`interaction.reasons.${reasonKey}`) : undefined;

  return (
    <div className="flex flex-col gap-1 border-t border-line/60 pt-1.5">
      {disabledReason === undefined && (
        <input
          type="text"
          data-testid="loading-button-text-input"
          placeholder={t('interaction.loadingTextPlaceholder')}
          value={loadingText}
          onChange={(e) => {
            setLoadingText(e.target.value);
          }}
          className="h-[26px] rounded border border-line bg-card-solid px-2 text-[11px] text-ink"
        />
      )}
      <ToolActionButton
        testId="make-loading-button"
        label={t('interaction.makeLoadingButton')}
        tooltip={t('interaction.makeLoadingButtonTooltip')}
        disabledReason={disabledReason}
        busy={busy}
        onClick={() => {
          void run(() =>
            applyInteraction({
              action: 'makeLoadingButton',
              element: { loc: source.loc, tag: source.tag },
              ...(loadingText.trim() !== '' ? { loadingText: loadingText.trim() } : {}),
            }),
          );
        }}
      />
      <InteractionErrorNotice error={error} />
    </div>
  );
}
