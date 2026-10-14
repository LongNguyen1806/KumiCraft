import { type ReactNode, useEffect, useId, useState } from 'react';

type DialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
};

/**
 * A modal dialog on the native `<dialog>`: the browser keeps keyboard focus inside, Esc closes it
 * and the page behind is inert.
 */
export function Dialog({ open, title, closeLabel, onClose, children }: DialogProps) {
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
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-panel whitespace-normal bg-card-solid p-0 text-ink shadow-soft backdrop:bg-wash-cool/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 px-7 pt-6 pb-2">
        <h2 id={titleId} className="text-[22px] font-light tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto h-9 rounded-full bg-field px-4 text-ink-soft hover:text-ink"
        >
          {closeLabel}
        </button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1 px-7 pb-7">{children}</div>
    </dialog>
  );
}
