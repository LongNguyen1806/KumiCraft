import { THEME_VAR_PREFIX, type ThemeToken, type ThemeTokenKind } from '@kumicraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const HEX6_RE = /^#[0-9a-fA-F]{6}$/;
const FONT_PREVIEW_SAMPLE = 'Aa';
const REMOVE_ICON = '\u00d7';

export interface BrandTokenPreviewProps {
  readonly kind: ThemeTokenKind;
  readonly value: string;
  readonly onColorPick?: ((nextHex: string) => void) | undefined;
}

export function BrandTokenPreview({ kind, value, onColorPick }: BrandTokenPreviewProps) {
  if (kind === 'color') {
    const isHex6 = HEX6_RE.test(value.trim());
    return (
      <label className="relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center">
        <span
          className="size-6 rounded border border-border"
          style={{ backgroundColor: value }}
          data-testid="brand-preview-color"
        />
        {isHex6 && onColorPick !== undefined && (
          <input
            type="color"
            value={value.trim()}
            onChange={(e) => {
              onColorPick(e.target.value);
            }}
            className="sr-only"
            aria-label={value}
          />
        )}
      </label>
    );
  }
  if (kind === 'font' || kind === 'fontSize') {
    const style = kind === 'font' ? { fontFamily: value } : { fontSize: value };
    return (
      <span
        className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center overflow-hidden px-1 text-xs leading-none text-ink"
        style={style}
      >
        {FONT_PREVIEW_SAMPLE}
      </span>
    );
  }
  const style = kind === 'radius' ? { borderRadius: value } : { boxShadow: value };
  return <span className="size-6 shrink-0 border border-border bg-card-solid" style={style} />;
}

interface ConfirmRemoveBannerProps {
  readonly name: string;
  readonly count: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function ConfirmRemoveBanner({ name, count, onCancel, onConfirm }: ConfirmRemoveBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 rounded bg-amber-500/10 p-2 text-xs text-ink">
      <p>{t('brand.confirmRemove', { name, count })}</p>
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
          data-testid="brand-confirm-delete"
          onClick={onConfirm}
          className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 cursor-pointer"
        >
          {t('brand.confirmDelete')}
        </button>
      </div>
    </div>
  );
}

interface TokenValueInputProps {
  readonly draft: string;
  readonly onChange: (val: string) => void;
  readonly onReset: () => void;
  readonly onCommit: (val: string) => void;
}

function TokenValueInput({ draft, onChange, onReset, onCommit }: TokenValueInputProps) {
  return (
    <input
      type="text"
      data-testid="brand-value"
      value={draft}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      onBlur={() => {
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(draft);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onReset();
        }
      }}
      className="h-7 min-w-0 flex-1 rounded border border-border bg-field px-2 font-mono text-xs text-ink"
    />
  );
}

interface TokenMainRowProps {
  readonly kind: ThemeTokenKind;
  readonly token: ThemeToken;
  readonly onCommitValue: (kind: ThemeTokenKind, name: string, value: string) => Promise<boolean>;
  readonly onRemoveClick: () => void;
}

type TokenNameColProps = {
  readonly kind: ThemeTokenKind;
  readonly token: ThemeToken;
};

function TokenNameCol({ kind, token }: TokenNameColProps) {
  return (
    <div className="flex w-24 shrink-0 flex-col">
      <span
        className="truncate text-xs font-medium text-ink"
        title={token.variable ?? `${THEME_VAR_PREFIX[kind]}${token.name}`}
      >
        {token.name}
      </span>
      {token.variable !== undefined && (
        <span
          data-testid="brand-token-variable"
          className="truncate font-mono text-[10px] text-ink-faint"
          title={token.variable}
        >
          {token.variable}
        </span>
      )}
    </div>
  );
}

type TokenActionBadgeProps = {
  readonly inherited?: boolean | undefined;
  readonly onRemoveClick: () => void;
};

function TokenActionBadge({ inherited, onRemoveClick }: TokenActionBadgeProps) {
  const { t } = useTranslation();
  if (inherited === true) {
    return (
      <span
        data-testid="brand-inherited"
        className="shrink-0 rounded bg-field px-1.5 py-0.5 text-[10px] text-ink-soft"
      >
        {t('brand.inherited')}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid="brand-remove"
      aria-label={t('brand.remove')}
      title={t('brand.remove')}
      onClick={onRemoveClick}
      className="flex size-6 shrink-0 items-center justify-center rounded text-ink-soft hover:bg-field hover:text-ink cursor-pointer"
    >
      {REMOVE_ICON}
    </button>
  );
}

function TokenMainRow({ kind, token, onCommitValue, onRemoveClick }: TokenMainRowProps) {
  const [editingDraft, setEditingDraft] = useState<string | undefined>(undefined);

  const commit = async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed !== token.value) await onCommitValue(kind, token.name, trimmed);
    setEditingDraft(undefined);
  };

  return (
    <div className="flex items-center gap-2">
      <BrandTokenPreview
        kind={kind}
        value={token.value}
        onColorPick={(hex) => {
          setEditingDraft(hex);
          void commit(hex);
        }}
      />
      <TokenNameCol kind={kind} token={token} />
      <TokenValueInput
        draft={editingDraft ?? token.value}
        onChange={setEditingDraft}
        onReset={() => {
          setEditingDraft(undefined);
        }}
        onCommit={(val) => {
          void commit(val);
        }}
      />
      <TokenActionBadge inherited={token.inherited} onRemoveClick={onRemoveClick} />
    </div>
  );
}

export interface BrandTokenRowProps {
  readonly kind: ThemeTokenKind;
  readonly token: ThemeToken;
  readonly onCommitValue: (kind: ThemeTokenKind, name: string, value: string) => Promise<boolean>;
  readonly onRequestRemove: (kind: ThemeTokenKind, name: string) => Promise<number | undefined>;
  readonly onConfirmRemove: (kind: ThemeTokenKind, name: string) => Promise<void>;
}

export function BrandTokenRow({
  kind,
  token,
  onCommitValue,
  onRequestRemove,
  onConfirmRemove,
}: BrandTokenRowProps) {
  const [confirmCount, setConfirmCount] = useState<number | undefined>(undefined);

  const remove = async () => {
    const count = await onRequestRemove(kind, token.name);
    if (count !== undefined && count > 0) setConfirmCount(count);
  };

  return (
    <div
      data-testid="brand-token"
      data-name={token.name}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-card-solid/60 p-2"
    >
      <TokenMainRow
        kind={kind}
        token={token}
        onCommitValue={onCommitValue}
        onRemoveClick={() => {
          void remove();
        }}
      />
      {confirmCount !== undefined && (
        <ConfirmRemoveBanner
          name={token.name}
          count={confirmCount}
          onCancel={() => {
            setConfirmCount(undefined);
          }}
          onConfirm={() => {
            setConfirmCount(undefined);
            void onConfirmRemove(kind, token.name);
          }}
        />
      )}
    </div>
  );
}
