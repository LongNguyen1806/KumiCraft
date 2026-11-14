const TOAST_TS = `import { cloneElement, type MouseEvent, type ReactElement, useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';
export type ToastPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom-center';

export type ToastPayload = {
  readonly message: string;
  readonly subtext?: string;
  readonly variant?: ToastVariant;
  readonly durationMs?: number;
  readonly position?: ToastPosition;
};

type ToastItem = ToastPayload & { readonly id: number };

const EVENT_NAME = 'kumicraft:toast';
let nextToastId = 1;

export function showToast(payload: ToastPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(EVENT_NAME, { detail: payload }));
}

const POSITION_STYLES: Record<ToastPosition, Record<string, string>> = {
  'bottom-right': { bottom: '16px', right: '16px' },
  'bottom-left': { bottom: '16px', left: '16px' },
  'top-right': { top: '16px', right: '16px' },
  'top-left': { top: '16px', left: '16px' },
  'top-center': { top: '16px', left: '50%', transform: 'translateX(-50%)' },
  'bottom-center': { bottom: '16px', left: '50%', transform: 'translateX(-50%)' },
};

const VARIANT_BORDER: Record<ToastVariant, string> = {
  success: '#16a34a',
  error: '#dc2626',
  info: '#2563eb',
};

export function ToastHost({ position = 'bottom-right' }: { readonly position?: ToastPosition }) {
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  const [activePos, setActivePos] = useState<ToastPosition>(position);

  useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;
      const id = nextToastId++;
      if (detail.position) setActivePos(detail.position);
      setItems((prev) => [...prev, { ...detail, id }].slice(-3));
      const ms = detail.durationMs ?? 4000;
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, ms);
    };
    window.addEventListener(EVENT_NAME, onToast);
    return () => window.removeEventListener(EVENT_NAME, onToast);
  }, []);

  if (items.length === 0) {
    return <div aria-live="polite" style={{ position: 'fixed', ...POSITION_STYLES[activePos], zIndex: 9999 }} />;
  }

  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      aria-live="polite"
      data-kc-toast-host="true"
      style={{
        position: 'fixed',
        ...POSITION_STYLES[activePos],
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '340px',
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => {
        const variant = item.variant ?? 'info';
        return (
          <div
            key={item.id}
            role="status"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#18181b',
              color: '#fafafa',
              borderLeft: \`4px solid \${VARIANT_BORDER[variant]}\`,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              fontSize: '13px',
              transition: reduced ? 'none' : 'opacity 150ms ease, transform 150ms ease',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{item.message}</div>
              {item.subtext && <div style={{ fontSize: '12px', opacity: 0.85 }}>{item.subtext}</div>}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#a1a1aa',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: '14px',
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export type ToastTriggerProps = ToastPayload & {
  readonly children: ReactElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void }>;
};

export function ToastTrigger({
  children,
  message,
  subtext,
  variant = 'info',
  durationMs = 4000,
  position,
}: ToastTriggerProps) {
  return cloneElement(children, {
    onClick: (e: MouseEvent<HTMLElement>) => {
      children.props.onClick?.(e);
      showToast({ message, subtext, variant, durationMs, position });
    },
  });
}
`;

const TOAST_JS = `import { cloneElement, useEffect, useState } from 'react';

const EVENT_NAME = 'kumicraft:toast';
let nextToastId = 1;

export function showToast(payload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
}

const POSITION_STYLES = {
  'bottom-right': { bottom: '16px', right: '16px' },
  'bottom-left': { bottom: '16px', left: '16px' },
  'top-right': { top: '16px', right: '16px' },
  'top-left': { top: '16px', left: '16px' },
  'top-center': { top: '16px', left: '50%', transform: 'translateX(-50%)' },
  'bottom-center': { bottom: '16px', left: '50%', transform: 'translateX(-50%)' },
};

const VARIANT_BORDER = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };

export function ToastHost({ position = 'bottom-right' }) {
  const [items, setItems] = useState([]);
  const [activePos, setActivePos] = useState(position);

  useEffect(() => {
    const onToast = (ev) => {
      const detail = ev.detail;
      if (!detail?.message) return;
      const id = nextToastId++;
      if (detail.position) setActivePos(detail.position);
      setItems((prev) => [...prev, { ...detail, id }].slice(-3));
      const ms = detail.durationMs ?? 4000;
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, ms);
    };
    window.addEventListener(EVENT_NAME, onToast);
    return () => window.removeEventListener(EVENT_NAME, onToast);
  }, []);

  if (items.length === 0) {
    return <div aria-live="polite" style={{ position: 'fixed', ...POSITION_STYLES[activePos], zIndex: 9999 }} />;
  }

  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      aria-live="polite"
      data-kc-toast-host="true"
      style={{
        position: 'fixed',
        ...POSITION_STYLES[activePos],
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '340px',
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => {
        const variant = item.variant ?? 'info';
        return (
          <div
            key={item.id}
            role="status"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: '#18181b',
              color: '#fafafa',
              borderLeft: \`4px solid \${VARIANT_BORDER[variant]}\`,
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              fontSize: '13px',
              transition: reduced ? 'none' : 'opacity 150ms ease, transform 150ms ease',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{item.message}</div>
              {item.subtext && <div style={{ fontSize: '12px', opacity: 0.85 }}>{item.subtext}</div>}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#a1a1aa',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: '14px',
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ToastTrigger({ children, message, subtext, variant = 'info', durationMs = 4000, position }) {
  return cloneElement(children, {
    onClick: (e) => {
      children.props.onClick?.(e);
      showToast({ message, subtext, variant, durationMs, position });
    },
  });
}
`;

export function buildToastTemplate(typescript: boolean): string {
  return typescript ? TOAST_TS : TOAST_JS;
}
