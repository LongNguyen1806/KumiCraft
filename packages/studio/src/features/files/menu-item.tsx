// One row of the Files panel menus (context menu and design actions).
import type { ReactNode } from 'react';

export type MenuItemProps = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly testId: string;
  readonly onClick: () => void;
  readonly danger?: boolean;
  readonly disabled?: boolean;
};

export function MenuItem({ icon, label, testId, onClick, danger, disabled }: MenuItemProps) {
  const cls = disabled
    ? 'cursor-not-allowed text-ink-soft opacity-40'
    : danger
      ? 'cursor-pointer text-danger hover:bg-field-hover'
      : 'cursor-pointer text-ink hover:bg-field-hover';
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs transition-colors ${cls}`}
    >
      <span className="size-4 shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
