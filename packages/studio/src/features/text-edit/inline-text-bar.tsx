// Floating inline text formatting toolbar during Canvas text selection (K9.7-2 TK-3).
import {
  type InsertedCss,
  lookFromTheme,
  primarySystem,
  type ProjectLook,
  resolveCssRoles,
  resolveTailwindRoles,
  type StyleSystemId,
  type WrapTextEdit,
} from '@kumicraft/shared';
import { Bold, Italic, Palette, Tag } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { applyStructureEdit } from '../../api/source-client.ts';
import { useThemeStore } from '../inspector/use-project-theme.ts';
import { useProjectStore } from '../project/project-store.ts';
import type { TextSelectionRange } from './use-canvas-text-edit.ts';

type InlineColorOption = {
  readonly id: string;
  readonly labelKey: 'colorPrimary' | 'colorRose' | 'colorAmber' | 'colorEmerald' | 'colorSky';
  readonly twClass: (look: ProjectLook) => string;
  readonly cssValue: (look: ProjectLook) => string;
};

const INLINE_COLORS: readonly InlineColorOption[] = [
  {
    id: 'primary',
    labelKey: 'colorPrimary',
    twClass: (look) => resolveTailwindRoles('text-{primary}', look),
    cssValue: (look) => look.roles.primary?.css ?? '#2563eb',
  },
  {
    id: 'rose',
    labelKey: 'colorRose',
    twClass: () => 'text-rose-600',
    cssValue: () => '#e11d48',
  },
  {
    id: 'amber',
    labelKey: 'colorAmber',
    twClass: () => 'text-amber-600',
    cssValue: () => '#d97706',
  },
  {
    id: 'emerald',
    labelKey: 'colorEmerald',
    twClass: () => 'text-emerald-600',
    cssValue: () => '#059669',
  },
  {
    id: 'sky',
    labelKey: 'colorSky',
    twClass: () => 'text-sky-600',
    cssValue: () => '#0284c7',
  },
];

function isTailwindSystem(system: StyleSystemId): boolean {
  return system === 'tailwind4' || system === 'tailwind3';
}

function buildBoldEdit(sel: TextSelectionRange, system: StyleSystemId): WrapTextEdit {
  const className =
    system === 'bootstrap5'
      ? 'fw-semibold'
      : isTailwindSystem(system)
        ? 'font-semibold'
        : undefined;
  return {
    kind: 'wrapText',
    loc: sel.ref.loc,
    tag: sel.tag,
    start: sel.start,
    end: sel.end,
    wrapper: { tag: 'strong', ...(className !== undefined ? { className } : {}) },
  };
}

function buildItalicEdit(sel: TextSelectionRange): WrapTextEdit {
  return {
    kind: 'wrapText',
    loc: sel.ref.loc,
    tag: sel.tag,
    start: sel.start,
    end: sel.end,
    wrapper: { tag: 'em' },
  };
}

function buildColorEdit(
  sel: TextSelectionRange,
  color: InlineColorOption,
  system: StyleSystemId,
  look: ProjectLook,
): WrapTextEdit {
  if (isTailwindSystem(system)) {
    return {
      kind: 'wrapText',
      loc: sel.ref.loc,
      tag: sel.tag,
      start: sel.start,
      end: sel.end,
      wrapper: { tag: 'span', className: color.twClass(look) },
    };
  }
  const cls = `kc-inline-color-${color.id}`;
  const css: InsertedCss = {
    rules: [{ selector: `.${cls}`, declarations: { color: color.cssValue(look) } }],
  };
  return {
    kind: 'wrapText',
    loc: sel.ref.loc,
    tag: sel.tag,
    start: sel.start,
    end: sel.end,
    wrapper: { tag: 'span', className: cls },
    css,
  };
}

function buildCssBadgeDeclarations(look: ProjectLook): Readonly<Record<string, string>> {
  return resolveCssRoles(
    {
      display: 'inline-flex',
      'align-items': 'center',
      padding: '0.125rem 0.5rem',
      'border-radius': '9999px',
      'font-size': '0.75rem',
      'font-weight': '600',
      'background-color': '{surface-muted}',
      color: '{primary}',
    },
    look,
  );
}

function buildBadgeEdit(
  sel: TextSelectionRange,
  system: StyleSystemId,
  look: ProjectLook,
): WrapTextEdit {
  const base = {
    kind: 'wrapText' as const,
    loc: sel.ref.loc,
    tag: sel.tag,
    start: sel.start,
    end: sel.end,
  };
  if (isTailwindSystem(system)) {
    const className = resolveTailwindRoles(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-{surface-muted} text-{primary} border border-{border}',
      look,
    );
    return { ...base, wrapper: { tag: 'span', className } };
  }
  if (system === 'bootstrap5') {
    return { ...base, wrapper: { tag: 'span', className: 'badge rounded-pill text-bg-primary' } };
  }
  return {
    ...base,
    wrapper: { tag: 'span', className: 'kc-inline-badge' },
    css: {
      rules: [{ selector: '.kc-inline-badge', declarations: buildCssBadgeDeclarations(look) }],
    },
  };
}

export type InlineTextBarProps = {
  readonly selection: TextSelectionRange | undefined;
  readonly onApplied: () => void;
};

function BarIconButton({
  testId,
  label,
  disabled,
  onClick,
  children,
}: {
  readonly testId: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded text-ink hover:bg-field disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BadgeActionButton({
  busy,
  label,
  onClick,
}: {
  readonly busy: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="inline-text-badge"
      disabled={busy}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-ink hover:bg-field disabled:opacity-40"
    >
      <Tag className="size-3" />
      <span>{label}</span>
    </button>
  );
}

function ToolbarActionButtons({
  busy,
  onBold,
  onItalic,
  onToggleColors,
  onBadge,
}: {
  readonly busy: boolean;
  readonly onBold: () => void;
  readonly onItalic: () => void;
  readonly onToggleColors: () => void;
  readonly onBadge: () => void;
}) {
  const { t } = useTranslation('common');
  return (
    <div className="flex items-center gap-1">
      <BarIconButton
        testId="inline-text-bold"
        label={t('textEdit.inlineBar.bold')}
        disabled={busy}
        onClick={onBold}
      >
        <Bold className="size-3.5" />
      </BarIconButton>
      <BarIconButton
        testId="inline-text-italic"
        label={t('textEdit.inlineBar.italic')}
        disabled={busy}
        onClick={onItalic}
      >
        <Italic className="size-3.5" />
      </BarIconButton>
      <BarIconButton
        testId="inline-text-color"
        label={t('textEdit.inlineBar.color')}
        disabled={busy}
        onClick={onToggleColors}
      >
        <Palette className="size-3.5" />
      </BarIconButton>
      <BadgeActionButton busy={busy} label={t('textEdit.inlineBar.badge')} onClick={onBadge} />
    </div>
  );
}

function ColorSwatchRow({
  look,
  busy,
  onPick,
}: {
  readonly look: ProjectLook;
  readonly busy: boolean;
  readonly onPick: (c: InlineColorOption) => void;
}) {
  const { t } = useTranslation('common');
  return (
    <div className="flex items-center gap-1.5 border-t border-line pt-1">
      {INLINE_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          data-testid={`inline-text-swatch-${color.id}`}
          title={t(`textEdit.inlineBar.${color.labelKey}`)}
          aria-label={t(`textEdit.inlineBar.${color.labelKey}`)}
          disabled={busy}
          onClick={() => {
            onPick(color);
          }}
          style={{ backgroundColor: color.cssValue(look) }}
          className="size-4 rounded-full border border-line hover:scale-110"
        />
      ))}
    </div>
  );
}

function useInlineWrapAction(onApplied: () => void) {
  const [showColors, setShowColors] = useState(false);
  const [busy, setBusy] = useState(false);
  const applyWrap = async (edit: WrapTextEdit) => {
    if (busy) return;
    setBusy(true);
    try {
      await applyStructureEdit(edit);
      setShowColors(false);
      onApplied();
    } finally {
      setBusy(false);
    }
  };
  return { showColors, setShowColors, busy, applyWrap };
}

export function InlineTextBar({ selection, onApplied }: InlineTextBarProps) {
  const { t } = useTranslation('common');
  const project = useProjectStore((s) => s.project);
  const theme = useThemeStore((s) => s.theme);
  const { showColors, setShowColors, busy, applyWrap } = useInlineWrapAction(onApplied);

  if (selection === undefined || selection.end <= selection.start) return undefined;
  const system: StyleSystemId =
    project?.support.styling !== undefined
      ? (primarySystem(project.support.styling) ?? 'tailwind4')
      : 'tailwind4';
  const look = lookFromTheme(theme);

  return (
    <div
      data-testid="inline-text-bar"
      role="toolbar"
      aria-label={t('textEdit.inlineBar.toolbar')}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      className="flex flex-col items-center gap-1 rounded-lg border border-line bg-card-solid p-1 shadow-soft"
    >
      <ToolbarActionButtons
        busy={busy}
        onBold={() => {
          void applyWrap(buildBoldEdit(selection, system));
        }}
        onItalic={() => {
          void applyWrap(buildItalicEdit(selection));
        }}
        onToggleColors={() => {
          setShowColors((v) => !v);
        }}
        onBadge={() => {
          void applyWrap(buildBadgeEdit(selection, system, look));
        }}
      />
      {showColors && (
        <ColorSwatchRow
          look={look}
          busy={busy}
          onPick={(color) => {
            void applyWrap(buildColorEdit(selection, color, system, look));
          }}
        />
      )}
    </div>
  );
}
