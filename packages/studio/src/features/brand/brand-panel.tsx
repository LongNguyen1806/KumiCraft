import {
  THEME_TOKEN_NAME,
  type ThemeEdit,
  type ThemeInfo,
  type ThemeToken,
  type ThemeTokenKind,
} from '@kumicraft/shared';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { editTheme, fetchThemeUsage } from '../../api/project-client.ts';
import { useHistoryStore } from '../../core/history-store.ts';
import { errorText, toErrorInfo } from '../../routes/error-text.ts';
import { useProjectTheme, useThemeStore } from '../inspector/use-project-theme.ts';
import { BrandFontPairsPanel } from './brand-font-pairs.tsx';
import { BrandHeader } from './brand-header.tsx';
import { BrandPalettePanel } from './brand-palette.tsx';
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
        className="h-6 rounded-md border border-line bg-card-solid px-2 text-xs text-ink hover:bg-field"
      >
        {t('brand.cancel')}
      </button>
      <button
        type="button"
        data-testid="brand-new-save"
        onClick={onSave}
        className="h-6 rounded-md bg-charcoal px-2.5 text-xs font-medium text-on-charcoal hover:bg-accent-hover"
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
    <div className="flex flex-col gap-1.5 rounded-[7px] border border-line bg-wash-cool p-2">
      <div className="flex gap-1.5">
        <input
          type="text"
          data-testid="brand-new-name"
          placeholder={t('brand.name')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          className="h-7 w-28 shrink-0 rounded-md border border-line bg-card-solid px-2 font-mono text-xs text-ink"
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
          className="h-7 min-w-0 flex-1 rounded-md border border-line bg-card-solid px-2 font-mono text-xs text-ink"
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
  readonly extraAction?: React.ReactNode | undefined;
}

function BrandGroupSection(props: BrandGroupSectionProps) {
  const { t } = useTranslation();
  return (
    <section data-testid={`brand-group-${props.kind}`} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-ink-faint">{props.title}</h3>
        <button
          type="button"
          data-testid={`brand-add-${props.kind}`}
          onClick={props.onStartAdd}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-field hover:text-ink cursor-pointer"
        >
          {t('brand.add')}
        </button>
      </div>
      {props.extraAction}
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

async function applyBrandEdit(
  edit: Parameters<typeof editTheme>[0],
  tErrors: TFunction<'errors'>,
  setErrorMsg: (msg: string | undefined) => void,
): Promise<ThemeInfo | undefined> {
  try {
    const updated = await editTheme(edit);
    useThemeStore.getState().setTheme(updated);
    void useHistoryStore.getState().load();
    setErrorMsg(undefined);
    return updated;
  } catch (err) {
    setErrorMsg(formatBrandError(err, tErrors));
    return undefined;
  }
}

function useBrandActions(t: TFunction, tErrors: TFunction<'errors'>) {
  const [addingKind, setAddingKind] = useState<ThemeTokenKind | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);

  const onApplyEdit = (edit: Parameters<typeof editTheme>[0]) =>
    applyBrandEdit(edit, tErrors, setErrorMsg);

  const onCommitValue = async (kind: ThemeTokenKind, name: string, value: string) =>
    (await onApplyEdit({ op: 'set', kind, name, value })) !== undefined;

  const onAddToken = async (kind: ThemeTokenKind, name: string, value: string) => {
    if (!THEME_TOKEN_NAME.test(name)) {
      setErrorMsg(t('brand.invalidName'));
      return false;
    }
    const ok = (await onApplyEdit({ op: 'add', kind, name, value })) !== undefined;
    if (ok) setAddingKind(undefined);
    return ok;
  };

  const onConfirmRemove = async (kind: ThemeTokenKind, name: string) => {
    await onApplyEdit({ op: 'remove', kind, name });
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
    onApplyEdit,
    onCommitValue,
    onAddToken,
    onConfirmRemove,
    onRequestRemove,
  };
}

function renderGroupExtra(
  kind: ThemeTokenKind,
  theme: ThemeInfo,
  onApplyEdit: (edit: ThemeEdit) => Promise<ThemeInfo | undefined>,
) {
  if (kind === 'color') {
    return <BrandPalettePanel existingColors={theme.colors} onApplyEdit={onApplyEdit} />;
  }
  if (kind === 'font') {
    return <BrandFontPairsPanel existingFonts={theme.fonts} onApplyEdit={onApplyEdit} />;
  }
  return undefined;
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
          className="rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs text-danger"
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
          extraAction={renderGroupExtra(group.kind, theme, actions.onApplyEdit)}
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
