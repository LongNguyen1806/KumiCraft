// Dark mode toggle, contrast suggestions, selected-state guard, and group-hover parent picker (K9.8-1 TK-74, TK-75).
import {
  type ClassContext,
  type DarkColorSuggestion,
  type ElementInfo,
  type ElementRef,
  projectBreakpoints,
  suggestDarkColors,
  type ThemeInfo,
  type TreeNode,
  writeValue,
} from '@kumicraft/shared';
import { Moon, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { enableDarkMode } from '../../../api/interaction-client.ts';
import { editSource, fetchElementSourceByLoc } from '../../../api/source-client.ts';
import { askAiWithDraft } from '../../chat/ask-ai-about-element.ts';
import { useSelectionStore } from '../../selection/selection-store.ts';
import type { InspectorTarget } from '../types.ts';
import { useThemeStore } from '../use-project-theme.ts';

type ElementTarget = Extract<InspectorTarget, { readonly kind: 'element' }>;

export function canEnableSelectedState(
  source: ElementTarget['source'],
  ref: ElementRef | undefined,
  selectionInfo: readonly ElementInfo[],
  treeNodes: readonly TreeNode[],
): boolean {
  if (source?.tag === 'SelectItem') return true;
  if (ref === undefined) return false;
  const tag = source?.tag ?? '';
  if (tag !== 'a' && tag !== 'Link') return false;
  const info = selectionInfo.find((i) => i.ref.loc === ref.loc && i.ref.index === ref.index);
  const ancestors = info?.ancestors ?? [];
  return ancestors.some((anc) => {
    const node = treeNodes.find((t) => t.ref.loc === anc.loc && t.ref.index === anc.index);
    return node?.tag === 'ScrollSpy';
  });
}

export function DarkModeToggleButton({
  dark,
  onToggle,
}: {
  readonly dark: boolean;
  readonly onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-testid="inspector-dark-toggle"
      aria-pressed={dark}
      title={t('inspector.darkToggleTooltip')}
      onClick={onToggle}
      className={`flex h-[26px] shrink-0 items-center gap-1 rounded-md border px-2 text-xs transition-colors ${
        dark
          ? 'border-accent bg-accent-soft font-medium text-accent'
          : 'border-line bg-card-solid text-ink-soft hover:bg-field'
      }`}
    >
      <Moon className="size-3.5" aria-hidden />
      <span>{t('inspector.stateDark')}</span>
    </button>
  );
}

/**
 * Dark colors would not apply yet: setting dark mode up touches the whole project and each project
 * does it its own way, so the job goes to the AI tab with a prepared request (QA K9.8-1).
 */
export function DarkModeSetupBanner({ onDismiss }: { readonly onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="dark-mode-prompt"
      className="flex flex-col gap-1.5 rounded-md border border-line bg-accent-soft/60 p-2 text-[11px] text-ink"
    >
      <span>{t('inspector.darkSetupPrompt')}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="dark-mode-ask-ai"
          title={t('interaction.askAiHint')}
          onClick={() => {
            askAiWithDraft(t('inspector.darkSetupAiPrompt'));
          }}
          className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90"
        >
          {t('interaction.askAi')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-1.5 py-0.5 text-[11px] text-ink-soft hover:bg-card-solid"
        >
          {t('inspector.dismissPrompt')}
        </button>
      </div>
    </div>
  );
}

function findThemeLightHex(theme: ThemeInfo): { bg?: string; text?: string } {
  const bg = theme.colors.find((c) => /surface|bg|background/i.test(c.name))?.value;
  const text = theme.colors.find((c) => /text|ink|foreground/i.test(c.name))?.value;
  return {
    ...(bg !== undefined ? { bg } : {}),
    ...(text !== undefined ? { text } : {}),
  };
}

async function applyTailwindDarkColors(
  target: ElementTarget,
  theme: ThemeInfo,
  suggestion: DarkColorSuggestion,
): Promise<boolean> {
  const src = target.source;
  if (src === undefined) return false;
  if (src.className.kind !== 'static' && src.className.kind !== 'none') return false;
  const before = src.className.kind === 'static' ? src.className.value : '';
  const bps = Object.fromEntries(projectBreakpoints(theme).map((b) => [b.key, b.min]));
  const ctx: ClassContext = {
    theme,
    mode: 'desktop-first',
    breakpoints: {
      sm: bps.sm ?? 640,
      md: bps.md ?? 768,
      lg: bps.lg ?? 1024,
      xl: bps.xl ?? 1280,
      '2xl': bps['2xl'] ?? 1536,
    },
  };
  const scope = { ...target.currentScope, dark: true };
  let after = before;
  for (const [prop, css] of [
    ['backgroundColor', suggestion.backgroundColor],
    ['textColor', suggestion.textColor],
    ['borderColor', suggestion.borderColor],
  ] as const) {
    after = writeValue(after, prop, scope, { kind: 'arbitrary', css }, ctx);
  }
  await editSource({
    edit: { kind: 'setClassName', loc: src.loc, tag: src.tag, before, after },
  });
  target.refresh();
  return true;
}

function DarkSuggestionCard({
  suggestion,
  busy,
  onApply,
}: {
  readonly suggestion: DarkColorSuggestion;
  readonly busy: boolean;
  readonly onApply: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="dark-color-suggestion-card"
      className="flex items-center justify-between gap-2 rounded-md border border-line bg-card-solid px-2 py-1.5 text-[11px]"
    >
      <div className="flex items-center gap-1.5">
        {[suggestion.backgroundColor, suggestion.textColor, suggestion.borderColor].map(
          (hex, i) => (
            <span
              key={`${hex}-${String(i)}`}
              className="size-4 rounded border border-line"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ),
        )}
        <span className="font-mono text-[10px] text-ink-soft">
          {String(suggestion.contrastRatio)}:1
        </span>
      </div>
      <button
        type="button"
        data-testid="apply-dark-colors-btn"
        disabled={busy}
        onClick={onApply}
        className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {t('inspector.applySuggestion')}
      </button>
    </div>
  );
}

export function DarkColorSuggestStrip({
  target,
  onApplyCssColors,
}: {
  readonly target: ElementTarget;
  readonly onApplyCssColors?: ((suggestion: DarkColorSuggestion) => Promise<void>) | undefined;
}) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const light = findThemeLightHex(theme);
  const suggestion = suggestDarkColors(light.bg, light.text);

  const handleApply = async () => {
    setBusy(true);
    try {
      if (onApplyCssColors !== undefined) await onApplyCssColors(suggestion);
      else await applyTailwindDarkColors(target, theme, suggestion);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      <button
        type="button"
        data-testid="suggest-dark-colors-btn"
        title={t('inspector.suggestDarkColorsTooltip')}
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="inline-flex w-fit items-center gap-1 rounded border border-line bg-card-solid px-2 py-0.5 text-[11px] text-ink hover:bg-field"
      >
        <Sparkles className="size-3 text-accent" aria-hidden />
        <span>{t('inspector.suggestDarkColors')}</span>
      </button>
      {open && (
        <DarkSuggestionCard
          suggestion={suggestion}
          busy={busy}
          onApply={() => {
            void handleApply();
          }}
        />
      )}
    </div>
  );
}

type AncestorOption = {
  readonly ref: ElementRef;
  readonly label: string;
};

function useAncestorOptions(ref: ElementRef): readonly AncestorOption[] {
  const selectionInfo = useSelectionStore((s) => s.selectionInfo);
  const treeNodes = useSelectionStore((s) => s.treeNodes);
  const info = selectionInfo.find((i) => i.ref.loc === ref.loc && i.ref.index === ref.index);
  const rawAncestors = info?.ancestors ?? [];
  return rawAncestors.map((anc) => {
    const node = treeNodes.find((t) => t.ref.loc === anc.loc && t.ref.index === anc.index);
    const label = node ? `<${node.tag}>${node.label ? ` ${node.label}` : ''}` : anc.loc;
    return { ref: anc, label };
  });
}

async function ensureGroupClassOnAncestor(ancRef: ElementRef): Promise<boolean> {
  const src = await fetchElementSourceByLoc(ancRef.loc);
  if (src === undefined) return false;
  if (src.className.kind !== 'static' && src.className.kind !== 'none') return false;
  const before = src.className.kind === 'static' ? src.className.value : '';
  if (/\bgroup\b/.test(before)) return true;
  const after = before === '' ? 'group' : `group ${before}`;
  await editSource({
    edit: { kind: 'setClassName', loc: src.loc, tag: src.tag, before, after },
  });
  return true;
}

function ancKey(ref: ElementRef): string {
  return `${ref.loc}#${String(ref.index)}`;
}

function AncestorSelect({
  options,
  value,
  onPick,
}: {
  readonly options: ReturnType<typeof useAncestorOptions>;
  readonly value: string;
  readonly onPick: (key: string) => void;
}) {
  return (
    <select
      data-testid="group-hover-parent-select"
      value={value}
      onChange={(e) => {
        onPick(e.target.value);
      }}
      className="h-[24px] min-w-0 flex-1 rounded border border-line bg-card-solid px-1.5 text-[11px] text-ink"
    >
      {options.map((opt) => (
        <option key={ancKey(opt.ref)} value={ancKey(opt.ref)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function GroupHoverParentPicker({
  target,
  onGroupChange,
}: {
  readonly target: ElementTarget;
  readonly onGroupChange: (ref: ElementRef | undefined) => void;
}) {
  const { t } = useTranslation();
  const options = useAncestorOptions(target.ref);
  const selectedKey = target.groupRef
    ? ancKey(target.groupRef)
    : options[0]
      ? ancKey(options[0].ref)
      : '';
  const [status, setStatus] = useState<string>();

  if (options.length === 0) return undefined;

  const handleSelectParent = async (key: string) => {
    const picked = options.find((o) => ancKey(o.ref) === key);
    onGroupChange(picked?.ref);
    if (picked !== undefined) {
      const ok = await ensureGroupClassOnAncestor(picked.ref);
      setStatus(ok ? t('inspector.groupParentReady') : undefined);
    }
  };

  return (
    <div className="flex flex-col gap-1 pt-0.5 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-ink-soft">{t('inspector.groupParentLabel')}</span>
        <AncestorSelect
          options={options}
          value={selectedKey}
          onPick={(key) => {
            void handleSelectParent(key);
          }}
        />
        <button
          type="button"
          data-testid="add-group-class-btn"
          onClick={() => {
            void handleSelectParent(selectedKey);
          }}
          className="shrink-0 rounded border border-line bg-card-solid px-1.5 py-0.5 text-[10px] text-ink hover:bg-field"
        >
          {t('inspector.addGroupClass')}
        </button>
      </div>
      {status !== undefined && <span className="text-[10px] text-accent">{status}</span>}
    </div>
  );
}

/** Asks once whether the project's dark colors would apply; never sets dark mode up itself. */
export function useDarkModePrompt() {
  const [promptNeeded, setPromptNeeded] = useState(false);

  const checkBeforeDarkUse = async () => {
    try {
      const res = await enableDarkMode({ checkOnly: true });
      setPromptNeeded(!res.enabled);
    } catch {
      // No open project: nothing to suggest.
    }
  };

  return {
    promptNeeded,
    checkBeforeDarkUse,
    dismiss: () => {
      setPromptNeeded(false);
    },
  };
}
