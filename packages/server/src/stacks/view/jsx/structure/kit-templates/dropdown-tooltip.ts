const DROPDOWN_TS = `import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type DropdownProps = {
  triggerLabel?: string;
  children?: ReactNode;
  className?: string;
};

export function Dropdown({ triggerLabel = 'Actions', children, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement | undefined>(undefined);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDesignToggle = (ev: Event) => {
      const detail = ev instanceof CustomEvent ? ev.detail : undefined;
      const forced = typeof detail?.open === 'boolean' ? detail.open : undefined;
      setOpen((prev) => (forced !== undefined ? forced : !prev));
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onOutside = (ev: Event) => {
      const target = ev.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="dropdown"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        ref={(el) => {
          triggerRef.current = el ?? undefined;
        }}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          padding: '8px 14px',
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
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            minWidth: '180px',
            padding: '6px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {children}
        </div>
      ) : undefined}
    </div>
  );
}
`;

const DROPDOWN_JS = `import { useEffect, useRef, useState } from 'react';

export function Dropdown({ triggerLabel = 'Actions', children, className }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(undefined);
  const triggerRef = useRef(undefined);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDesignToggle = (ev) => {
      const detail = ev instanceof CustomEvent ? ev.detail : undefined;
      const forced = typeof detail?.open === 'boolean' ? detail.open : undefined;
      setOpen((prev) => (forced !== undefined ? forced : !prev));
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onOutside = (ev) => {
      const target = ev.target;
      if (target instanceof Node && !rootRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="dropdown"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        ref={(el) => {
          triggerRef.current = el ?? undefined;
        }}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          padding: '8px 14px',
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
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            minWidth: '180px',
            padding: '6px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {children}
        </div>
      ) : undefined}
    </div>
  );
}
`;

const TOOLTIP_TS = `import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type TooltipProps = {
  label?: string;
  content: string;
  children?: ReactNode;
  className?: string;
};

export function Tooltip({ label = 'Info', content, children, className }: TooltipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | undefined>(undefined);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDesignToggle = (ev: Event) => {
      const detail = ev instanceof CustomEvent ? ev.detail : undefined;
      const forced = typeof detail?.open === 'boolean' ? detail.open : undefined;
      setOpen((prev) => (forced !== undefined ? forced : !prev));
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, []);

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="tooltip"
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(ev) => {
        if (ev.key === 'Escape') setOpen(false);
      }}
    >
      {children ?? (
        <button
          type="button"
          aria-describedby={open ? tipId : undefined}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: 'transparent',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      )}
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: '#111827',
            color: '#ffffff',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {content}
        </span>
      ) : undefined}
    </div>
  );
}
`;

const TOOLTIP_JS = `import { useEffect, useId, useRef, useState } from 'react';

export function Tooltip({ label = 'Info', content, children, className }) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(undefined);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onDesignToggle = (ev) => {
      const detail = ev instanceof CustomEvent ? ev.detail : undefined;
      const forced = typeof detail?.open === 'boolean' ? detail.open : undefined;
      setOpen((prev) => (forced !== undefined ? forced : !prev));
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, []);

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="tooltip"
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(ev) => {
        if (ev.key === 'Escape') setOpen(false);
      }}
    >
      {children ?? (
        <button
          type="button"
          aria-describedby={open ? tipId : undefined}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: 'transparent',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      )}
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: '#111827',
            color: '#ffffff',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {content}
        </span>
      ) : undefined}
    </div>
  );
}
`;

export function buildDropdownTemplate(typescript: boolean): string {
  return typescript ? DROPDOWN_TS : DROPDOWN_JS;
}

export function buildTooltipTemplate(typescript: boolean): string {
  return typescript ? TOOLTIP_TS : TOOLTIP_JS;
}
