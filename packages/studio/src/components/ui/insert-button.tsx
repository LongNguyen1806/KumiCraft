import { Plus } from 'lucide-react';

type InsertButtonProps = {
  readonly testId: string;
  /** Read aloud and shown on hover: what the button inserts, or why it cannot. */
  readonly label: string;
  readonly disabled: boolean;
  readonly onInsert: () => void;
};

/**
 * The + in the corner of a Library block or a Component item: the only click that inserts at the
 * selection (R-LB-14, R-CP-13). The tile around it is for dragging only.
 */
export function InsertButton({ testId, label, disabled, onInsert }: InsertButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onInsert}
      className="absolute top-[3px] right-[3px] flex size-[18px] cursor-pointer items-center justify-center rounded text-ink-faint hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
    >
      <Plus className="size-3.5" />
    </button>
  );
}
