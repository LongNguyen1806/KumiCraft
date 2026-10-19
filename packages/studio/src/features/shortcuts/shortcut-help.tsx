// Shortcut help modal dialog (SPEC-04 section 19, R-KB-12).
import { type ShortcutAction, shortcutLabel } from '@reactcraft/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { isApplePlatform } from '../../app/platform.ts';
import { useShortcutHelpStore } from './shortcut-help-store.ts';

const SHORTCUT_GROUPS = [
  {
    groupKey: 'shortcuts.groups.general',
    items: [
      { action: 'undo', labelKey: 'shortcuts.actions.undo' },
      { action: 'redo', labelKey: 'shortcuts.actions.redo' },
      { action: 'showShortcuts', labelKey: 'shortcuts.actions.showShortcuts' },
      { action: 'togglePanels', labelKey: 'shortcuts.actions.togglePanels' },
    ],
  },
  {
    groupKey: 'shortcuts.groups.structure',
    items: [
      { action: 'duplicate', labelKey: 'shortcuts.actions.duplicate' },
      { action: 'remove', labelKey: 'shortcuts.actions.remove' },
      { action: 'wrap', labelKey: 'shortcuts.actions.wrap' },
      { action: 'unwrap', labelKey: 'shortcuts.actions.unwrap' },
      { action: 'moveUp', labelKey: 'shortcuts.actions.moveUp' },
      { action: 'moveDown', labelKey: 'shortcuts.actions.moveDown' },
      { action: 'selectParent', labelKey: 'shortcuts.actions.selectParent' },
    ],
  },
  {
    groupKey: 'shortcuts.groups.canvas',
    items: [
      { action: 'zoomIn', labelKey: 'shortcuts.actions.zoomIn' },
      { action: 'zoomOut', labelKey: 'shortcuts.actions.zoomOut' },
      { action: 'zoomReset', labelKey: 'shortcuts.actions.zoomReset' },
      { action: 'zoomFit', labelKey: 'shortcuts.actions.zoomFit' },
      { action: 'togglePreview', labelKey: 'shortcuts.actions.togglePreview' },
      { action: 'openInEditor', labelKey: 'shortcuts.actions.openInEditor' },
      { action: 'nudgeLeft', labelKey: 'shortcuts.actions.nudge' },
      { action: 'nudgeLeftFine', labelKey: 'shortcuts.actions.nudgeFine' },
    ],
  },
  {
    groupKey: 'shortcuts.groups.frames',
    items: [{ action: 'frame1', labelKey: 'shortcuts.actions.frames' }],
  },
] as const;

function displayShortcutKey(action: ShortcutAction, apple: boolean): string {
  if (action === 'frame1') return '1…8';
  if (action === 'nudgeLeft') return '← → ↑ ↓';
  if (action === 'nudgeLeftFine') return 'Shift + mũi tên';
  return shortcutLabel(action, apple);
}

function ShortcutGroupsList({ apple }: { readonly apple: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.groupKey} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            {t(group.groupKey)}
          </h3>
          <div className="divide-y divide-border/20 rounded-lg border border-border/30 bg-field/40 px-3">
            {group.items.map((item) => (
              <div key={item.action} className="flex items-center justify-between py-2 text-xs">
                <span className="text-ink">{t(item.labelKey)}</span>
                <kbd className="rounded border border-border/60 bg-field px-2 py-0.5 font-mono text-[11px] font-medium text-ink-strong shadow-xs">
                  {displayShortcutKey(item.action, apple)}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type ShortcutHelpHeaderProps = {
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
};

function ShortcutHelpHeader({ title, closeLabel, onClose }: ShortcutHelpHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-ink-soft hover:bg-border/30 hover:text-ink text-sm font-medium"
        data-testid="shortcut-help-close"
      >
        {closeLabel}
      </button>
    </div>
  );
}

export function ShortcutHelp() {
  const { t } = useTranslation();
  const isOpen = useShortcutHelpStore((s) => s.isOpen);
  const close = useShortcutHelpStore((s) => s.close);
  const apple = isApplePlatform();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, close]);

  if (!isOpen) return undefined;

  return (
    <div
      data-testid="shortcut-help"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('shortcuts.close')}
        className="fixed inset-0 h-full w-full cursor-default bg-transparent"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.title')}
        className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-border bg-card-solid p-6 shadow-2xl overflow-hidden"
      >
        <ShortcutHelpHeader
          title={t('shortcuts.title')}
          closeLabel={t('shortcuts.close')}
          onClose={close}
        />

        <ShortcutGroupsList apple={apple} />
      </div>
    </div>
  );
}
