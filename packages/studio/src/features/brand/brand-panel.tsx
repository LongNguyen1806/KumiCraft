import {
  THEME_TOKEN_NAME,
  type ThemeInfo,
  type ThemeToken,
  type ThemeTokenKind,
} from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { editTheme, fetchThemeUsage } from '../../api/project-client.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useHistoryStore } from '../history/history-store.ts';
import { useProjectTheme, useThemeStore } from '../inspector/use-project-theme.ts';
import { BrandTokenRow } from './brand-token-row.tsx';

function formatBrandError(err: unknown, tErrors: TFunction<'errors'>): string {
  const info = toErrorInfo(err);
  return errorText(tErrors, info.code, info.params);
}

interface AddTokenActionsProps {
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

function AddTokenActions({ onCancel, onSave }: AddTokenActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end gap-1.5">
      <button
        type="button"
        onClick={onCancel}
        className="rounded border border-border bg-field px-2 py-0.5 text-xs text-ink hover:bg-field-hover cursor-pointer"
      >
        {t('brand.cancel')}
      </button>
      <button
        type="button"
        data-testid="brand-new-save"
        onClick={onSave}
        className="rounded bg-charcoal px-2.5 py-0.5 text-xs font-medium text-white hover:opacity-90 cursor-pointer"
      >
        {t('brand.save')}
      </button>
    </div>
  );
}

interface AddTokenFormProps {
  readonly kind: ThemeTokenKind;
  readonly onSubmit: (kind: ThemeTokenKind, name: string, value: string) => Promise<boolean>;
  readonly onCancel: () => void;
}

function AddTokenForm({ kind, onSubmit, onCancel }: AddTokenFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const save = async () => {
    if (await onSubmit(kind, name.trim(), value.trim())) {
      setName('');
      setValue('');
    }
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-field/60 p-2">
      <div className="flex gap-1.5">
        <input
          type="text"
          data-testid="brand-new-name"
          placeholder={t('brand.name')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          className="h-7 w-28 shrink-0 rounded border border-border bg-card-solid px-2 font-mono text-xs text-ink"
        />
        <input
          type="text"
          data-testid="brand-new-value"
          placeholder={t('brand.value')}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            else if (e.key === 'Escape') onCancel();
          }}
          className="h-7 min-w-0 flex-1 rounded border border-border bg-card-solid px-2 font-mono text-xs text-ink"
        />
      </div>
      <AddTokenActions
        onCancel={onCancel}
        onSave={() => {
          void save();
        }}
      />
    </div>
  );
}

interface BrandGroupSectionProps {
  readonly kind: ThemeTokenKind;
  readonly title: string;
  readonly tokens: readonly ThemeToken[];
  readonly isAdding: boolean;
  readonly onStartAdd: () => void;
  readonly onCancelAdd: () => void;
  readonly onAddToken: (kind: ThemeTokenKind, name: string, value: string) => Promise<boolean>;
  readonly onCommitValue: (kind: ThemeTokenKind, name: string, value: string) => Promise<boolean>;
  readonly onRequestRemove: (kind: ThemeTokenKind, name: string) => Promise<number | undefined>;
  readonly onConfirmRemove: (kind: ThemeTokenKind, name: string) => Promise<void>;
}

function BrandGroupSection(props: BrandGroupSectionProps) {
  const { t } = useTranslation();
  return (
    <section data-testid={`brand-group-${props.kind}`} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
          {props.title}
        </h3>
        <button
          type="button"
          data-testid={`brand-add-${props.kind}`}
          onClick={props.onStartAdd}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-field hover:text-ink cursor-pointer"
        >
          {t('brand.add')}
        </button>
      </div>
      {props.isAdding && (
        <AddTokenForm kind={props.kind} onSubmit={props.onAddToken} onCancel={props.onCancelAdd} />
      )}
      {props.tokens.length === 0 ? (
        <p className="py-1 text-xs text-ink-faint">{t('brand.emptyGroup')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {props.tokens.map((token) => (
            <BrandTokenRow
              key={token.name}
              kind={props.kind}
              token={token}
              onCommitValue={props.onCommitValue}
              onRequestRemove={props.onRequestRemove}
              onConfirmRemove={props.onConfirmRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function getGroupConfigs(
  theme: ThemeInfo,
  t: TFunction,
): readonly { kind: ThemeTokenKind; title: string; tokens: readonly ThemeToken[] }[] {
  return [
    { kind: 'color', title: t('brand.colors'), tokens: theme.colors },
    { kind: 'font', title: t('brand.fonts'), tokens: theme.fonts },
    { kind: 'fontSize', title: t('brand.fontSizes'), tokens: theme.fontSizes },
    { kind: 'radius', title: t('brand.radii'), tokens: theme.radii },
    { kind: 'shadow', title: t('brand.shadows'), tokens: theme.shadows },
  ];
}

async function runBrandEdit(
  edit: Parameters<typeof editTheme>[0],
  tErrors: TFunction<'errors'>,
  setErrorMsg: (msg: string | undefined) => void,
): Promise<boolean> {
  try {
    const updated = await editTheme(edit);
    useThemeStore.getState().setTheme(updated);
    void useHistoryStore.getState().load();
    setErrorMsg(undefined);
    return true;
  } catch (err) {
    setErrorMsg(formatBrandError(err, tErrors));
    return false;
  }
}

function useBrandActions(t: TFunction, tErrors: TFunction<'errors'>) {
  const [addingKind, setAddingKind] = useState<ThemeTokenKind | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);

  const onCommitValue = (kind: ThemeTokenKind, name: string, value: string) =>
    runBrandEdit({ op: 'set', kind, name, value }, tErrors, setErrorMsg);

  const onAddToken = async (kind: ThemeTokenKind, name: string, value: string) => {
    if (!THEME_TOKEN_NAME.test(name)) {
      setErrorMsg(t('brand.invalidName'));
      return false;
    }
    const ok = await runBrandEdit({ op: 'add', kind, name, value }, tErrors, setErrorMsg);
    if (ok) setAddingKind(undefined);
    return ok;
  };

  const onConfirmRemove = async (kind: ThemeTokenKind, name: string) => {
    await runBrandEdit({ op: 'remove', kind, name }, tErrors, setErrorMsg);
  };

  const onRequestRemove = async (kind: ThemeTokenKind, name: string) => {
    try {
      const { count } = await fetchThemeUsage(kind, name);
      if (count === 0) await onConfirmRemove(kind, name);
      return count;
    } catch (err) {
      setErrorMsg(formatBrandError(err, tErrors));
      return undefined;
    }
  };

  return {
    addingKind,
    setAddingKind,
    errorMsg,
    setErrorMsg,
    onCommitValue,
    onAddToken,
    onConfirmRemove,
    onRequestRemove,
  };
}

type BrandHeaderProps = {
  readonly system: string;
  readonly file: string;
};

function BrandHeader({ system, file }: BrandHeaderProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="brand-header"
      className="flex flex-col gap-0.5 border-b border-border pb-2 text-xs"
    >
      <span className="font-semibold text-ink" data-testid="brand-system-name">
        {t(`brand.system.${system}`, { defaultValue: system })}
      </span>
      <span className="font-mono text-ink-faint" data-testid="brand-file-path">
        {file}
      </span>
    </div>
  );
}

export function BrandPanel() {
  const { t } = useTranslation();
  const { t: tErrors } = useTranslation('errors');
  const theme = useProjectTheme();
  const actions = useBrandActions(t, tErrors);

  if (!theme.file) {
    return (
      <div data-testid="brand-empty" className="p-3 text-xs text-ink-faint">
        {t('brand.noThemeFile')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-2" data-testid="brand-panel">
      {theme.system !== undefined && <BrandHeader system={theme.system} file={theme.file} />}
      {actions.errorMsg !== undefined && (
        <div
          data-testid="brand-error"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-700"
        >
          {actions.errorMsg}
        </div>
      )}
      {getGroupConfigs(theme, t).map((group) => (
        <BrandGroupSection
          key={group.kind}
          kind={group.kind}
          title={group.title}
          tokens={group.tokens}
          isAdding={actions.addingKind === group.kind}
          onStartAdd={() => {
            actions.setErrorMsg(undefined);
            actions.setAddingKind(group.kind);
          }}
          onCancelAdd={() => {
            actions.setAddingKind(undefined);
          }}
          onAddToken={actions.onAddToken}
          onCommitValue={actions.onCommitValue}
          onRequestRemove={actions.onRequestRemove}
          onConfirmRemove={actions.onConfirmRemove}
        />
      ))}
    </div>
  );
}
