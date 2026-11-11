// The Wrap menu of the Inspector action row: an icon button that opens a small menu of the three
// wrappers. A native <select> over the icon opened a list as narrow as the icon.
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Columns3, Grid2x2, Group, Rows3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type Wrapper = 'row' | 'column' | 'grid';

const ITEMS: readonly {
  readonly id: Wrapper;
  readonly icon: LucideIcon;
  readonly label: 'inspector.wrapRow' | 'inspector.wrapColumn' | 'inspector.wrapGrid';
}[] = [
  { id: 'row', icon: Columns3, label: 'inspector.wrapRow' },
  { id: 'column', icon: Rows3, label: 'inspector.wrapColumn' },
  { id: 'grid', icon: Grid2x2, label: 'inspector.wrapGrid' },
];

/** Closes the menu on a click outside it or on Escape. */
function useDismiss(open: boolean, root: HTMLElement | undefined, close: () => void): void {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (root !== undefined && event.target instanceof Node && !root.contains(event.target)) {
        close();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, root, close]);
}

function WrapMenuList({ onPick }: { readonly onPick: (wrapper: Wrapper) => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="menu"
      aria-label={t('inspector.wrap')}
      className="absolute top-full left-0 z-30 mt-1 grid min-w-40 gap-px rounded-lg border border-line bg-card-solid p-1 shadow-soft"
    >
      {ITEMS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          role="menuitem"
          data-testid={`inspector-wrap-${id}`}
          onClick={() => {
            onPick(id);
          }}
          className="flex h-8 items-center gap-2 rounded-md px-2.5 text-left text-xs text-ink hover:bg-field"
        >
          <Icon className="size-4 shrink-0 text-ink-soft" aria-hidden />
          {t(label)}
        </button>
      ))}
    </div>
  );
}

export function WrapMenu({
  disabled,
  onWrap,
}: {
  readonly disabled: boolean;
  readonly onWrap: (wrapper: Wrapper) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [root, setRoot] = useState<HTMLSpanElement>();
  const close = () => {
    setOpen(false);
  };
  useDismiss(open, root, close);

  return (
    <span
      ref={(el) => {
        setRoot(el ?? undefined);
      }}
      className="relative shrink-0"
    >
      <button
        type="button"
        data-testid="inspector-wrap"
        aria-label={t('inspector.wrap')}
        title={t('inspector.wrap')}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-ink-soft transition-colors hover:bg-field hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent aria-expanded:bg-field aria-expanded:text-ink"
      >
        <Group className="size-[15px]" aria-hidden />
        <ChevronDown className="size-3" aria-hidden />
      </button>
      {open && (
        <WrapMenuList
          onPick={(id) => {
            close();
            onWrap(id);
          }}
        />
      )}
    </span>
  );
}
