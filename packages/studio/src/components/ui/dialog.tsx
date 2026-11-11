import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';

type DialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** 'wide' for settings with several fields per row. */
  readonly size?: 'normal' | 'wide' | undefined;
  /** Drawn at the right of the title row, before the close button (e.g. "Saved"). */
  readonly headerExtra?: ReactNode;
  /** Set when the body lays itself out edge to edge (a side menu, for example). */
  readonly flush?: boolean | undefined;
};

function DialogHeader({
  titleId,
  title,
  closeLabel,
  onClose,
  extra,
}: {
  readonly titleId: string;
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly extra: ReactNode;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line pr-2.5 pl-5">
      <h2 id={titleId} className="truncate text-[15px] font-semibold">
        {title}
      </h2>
      <span className="ml-auto flex items-center gap-2">
        {extra}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-field hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </span>
    </div>
  );
}

/**
 * A modal dialog on the native `<dialog>`: the browser keeps keyboard focus inside, Esc closes it
 * and the page behind is inert. One shell for every dialog: a 48 px title row with a line under it
 * and a close button.
 */
export function Dialog({
  open,
  title,
  closeLabel,
  onClose,
  children,
  size,
  headerExtra,
  flush,
}: DialogProps) {
  const [element, setElement] = useState<HTMLDialogElement>();
  const titleId = useId();

  useEffect(() => {
    if (element === undefined) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [element, open]);

  return (
    <dialog
      ref={(node) => {
        setElement(node ?? undefined);
      }}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`m-auto ${size === 'wide' ? 'w-[min(760px,calc(100vw-32px))]' : 'w-[min(520px,calc(100vw-32px))]'} max-h-[calc(100vh-48px)] overflow-hidden rounded-panel border border-line bg-card-solid p-0 whitespace-normal text-ink shadow-soft backdrop:bg-ink/25`}
    >
      <div className="flex max-h-[calc(100vh-48px)] flex-col">
        <DialogHeader
          titleId={titleId}
          title={title}
          closeLabel={closeLabel}
          onClose={onClose}
          extra={headerExtra}
        />
        <div
          className={
            flush === true
              ? 'min-h-0 flex-1 overflow-auto'
              : 'grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-1 overflow-auto px-5 pt-4 pb-5'
          }
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
