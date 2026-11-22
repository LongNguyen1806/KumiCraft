const MODAL_TS = `import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ModalProps = {
  triggerLabel?: string;
  title?: string;
  children?: ReactNode;
  className?: string;
};

export function Modal({
  triggerLabel = 'Open dialog',
  title = 'Dialog',
  children,
  className,
}: ModalProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState(false);
  const rootRef = useRef<HTMLDivElement | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement | undefined>(undefined);

  const closeDialog = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        try {
          if (modalMode && typeof dialog.showModal === 'function') dialog.showModal();
          else if (typeof dialog.show === 'function') dialog.show();
          else dialog.setAttribute('open', '');
        } catch {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open || dialog.hasAttribute('open')) {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open, modalMode]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDesignToggle = (ev: Event) => {
      const detail = ev instanceof CustomEvent ? ev.detail : undefined;
      const forced = typeof detail?.open === 'boolean' ? detail.open : undefined;
      setModalMode(false);
      setOpen((prev) => (forced !== undefined ? forced : !prev));
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeDialog(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="modal"
    >
      <button
        ref={(el) => {
          triggerRef.current = el ?? undefined;
        }}
        type="button"
        onClick={() => {
          setModalMode(true);
          setOpen(true);
        }}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          backgroundColor: 'transparent',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={(el) => {
          dialogRef.current = el ?? undefined;
        }}
        aria-labelledby={titleId}
        onCancel={(ev) => {
          ev.preventDefault();
          closeDialog(true);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          margin: 'auto',
          zIndex: 50,
          maxWidth: '460px',
          width: '92%',
          padding: '24px',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <h2 id={titleId} style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => closeDialog(true)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div>{children}</div>
      </dialog>
    </div>
  );
}
`;

const MODAL_JS = `import { useEffect, useId, useRef, useState } from 'react';

export function Modal({
  triggerLabel = 'Open dialog',
  title = 'Dialog',
  children,
  className,
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [modalMode, setModalMode] = useState(false);
  const rootRef = useRef(undefined);
  const triggerRef = useRef(undefined);
  const dialogRef = useRef(undefined);

  const closeDialog = (restoreFocus) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        try {
          if (modalMode && typeof dialog.showModal === 'function') dialog.showModal();
          else if (typeof dialog.show === 'function') dialog.show();
          else dialog.setAttribute('open', '');
        } catch {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open || dialog.hasAttribute('open')) {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open, modalMode]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDesignToggle = (ev) => {
      const detail = ev instanceof CustomEvent ? ev.detail : undefined;
      const forced = typeof detail?.open === 'boolean' ? detail.open : undefined;
      setModalMode(false);
      setOpen((prev) => (forced !== undefined ? forced : !prev));
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        closeDialog(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="modal"
    >
      <button
        ref={(el) => {
          triggerRef.current = el ?? undefined;
        }}
        type="button"
        onClick={() => {
          setModalMode(true);
          setOpen(true);
        }}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #d1d5db',
          backgroundColor: 'transparent',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={(el) => {
          dialogRef.current = el ?? undefined;
        }}
        aria-labelledby={titleId}
        onCancel={(ev) => {
          ev.preventDefault();
          closeDialog(true);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          margin: 'auto',
          zIndex: 50,
          maxWidth: '460px',
          width: '92%',
          padding: '24px',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <h2 id={titleId} style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => closeDialog(true)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div>{children}</div>
      </dialog>
    </div>
  );
}
`;

export function buildModalTemplate(typescript: boolean): string {
  return typescript ? MODAL_TS : MODAL_JS;
}

export function buildDrawerTemplate(typescript: boolean): string {
  const base = typescript ? MODAL_TS : MODAL_JS;
  return base
    .replace(/export type ModalProps/g, 'export type DrawerProps')
    .replace(/: ModalProps/g, ': DrawerProps')
    .replace(/export function Modal\(/g, 'export function Drawer(')
    .replace("triggerLabel = 'Open dialog'", "triggerLabel = 'Open drawer'")
    .replace("title = 'Dialog'", "title = 'Drawer'")
    .replace('data-kc-interactive="modal"', 'data-kc-interactive="drawer"')
    .replace("margin: 'auto',", "margin: '0 0 0 auto',\n          height: '100vh',");
}
