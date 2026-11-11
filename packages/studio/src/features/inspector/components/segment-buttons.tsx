// Joined buttons for the few most used values of a property (P5); the select beside them keeps
// every value.
import type { PropertyId } from '@kumicraft/shared';
import type { LucideIcon } from 'lucide-react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowRight,
} from 'lucide-react';

const ICONS: Readonly<Record<string, LucideIcon | undefined>> = {
  'textAlign:left': AlignLeft,
  'textAlign:center': AlignCenter,
  'textAlign:right': AlignRight,
  'textAlign:justify': AlignJustify,
  'flexDirection:row': ArrowRight,
  'flexDirection:col': ArrowDown,
};

type SegmentButtonsProps = {
  readonly property: PropertyId;
  readonly segments: readonly string[];
  readonly current: string;
  readonly disabled: boolean;
  /** Called with the value, or with '' when the pressed value is clicked again. */
  readonly onPick: (value: string) => void;
};

export function SegmentButtons({
  property,
  segments,
  current,
  disabled,
  onPick,
}: SegmentButtonsProps) {
  return (
    <div className="flex min-w-0 flex-1 gap-0.5 rounded-md bg-field p-0.5">
      {segments.map((value) => {
        const Icon = ICONS[`${property}:${value}`];
        const pressed = current === value;
        return (
          <button
            key={value}
            type="button"
            data-testid={`segment-${property}-${value}`}
            aria-pressed={pressed}
            aria-label={Icon === undefined ? undefined : value}
            title={value}
            disabled={disabled}
            onClick={() => {
              onPick(pressed ? '' : value);
            }}
            className="grid h-6 min-w-0 flex-1 place-items-center rounded-[5px] px-1 font-mono text-[11px] text-ink-soft hover:text-ink disabled:opacity-50 aria-pressed:bg-card-solid aria-pressed:font-medium aria-pressed:text-accent aria-pressed:shadow-[0_0_0_1px_var(--color-line)]"
          >
            {Icon === undefined ? (
              <span className="truncate">{value}</span>
            ) : (
              <Icon className="size-3.5" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
