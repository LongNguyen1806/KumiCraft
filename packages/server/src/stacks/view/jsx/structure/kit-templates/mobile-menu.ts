const MOBILE_MENU_TS = `import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type MobileMenuProps = {
  brand?: string;
  children?: ReactNode;
  className?: string;
};

export function MobileMenu({ brand = 'Brand', children, className }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const rootRef = useRef<HTMLElement | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 640px)');
    setWide(mq.matches);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

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

  const showLinks = wide || open;

  return (
    <nav
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="mobile-menu"
      style={{ padding: '12px 16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ fontSize: '16px', fontWeight: 700 }}>{brand}</span>
        {!wide ? (
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Menu
          </button>
        ) : undefined}
        {wide ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            {children}
          </div>
        ) : undefined}
      </div>
      {!wide && showLinks ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingTop: '12px',
            marginTop: '12px',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          {children}
        </div>
      ) : undefined}
    </nav>
  );
}
`;

const MOBILE_MENU_JS = `import { useEffect, useRef, useState } from 'react';

export function MobileMenu({ brand = 'Brand', children, className }) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const rootRef = useRef(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 640px)');
    setWide(mq.matches);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

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

  const showLinks = wide || open;

  return (
    <nav
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="mobile-menu"
      style={{ padding: '12px 16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span style={{ fontSize: '16px', fontWeight: 700 }}>{brand}</span>
        {!wide ? (
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Menu
          </button>
        ) : undefined}
        {wide ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
            {children}
          </div>
        ) : undefined}
      </div>
      {!wide && showLinks ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingTop: '12px',
            marginTop: '12px',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          {children}
        </div>
      ) : undefined}
    </nav>
  );
}
`;

export function buildMobileMenuTemplate(typescript: boolean): string {
  return typescript ? MOBILE_MENU_TS : MOBILE_MENU_JS;
}
