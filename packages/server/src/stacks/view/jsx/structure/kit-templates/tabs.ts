const TABS_TS = `import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export type TabProps = {
  label: string;
  children?: ReactNode;
  className?: string;
};

export function Tab({ children, className }: TabProps) {
  return <div className={className}>{children}</div>;
}

export type TabsProps = {
  children?: ReactNode;
  defaultIndex?: number;
  className?: string;
};

export function Tabs({ children, defaultIndex = 0, className }: TabsProps) {
  const baseId = useId();
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const rootRef = useRef<HTMLDivElement | undefined>(undefined);
  const tabRefs = useRef<Array<HTMLButtonElement | undefined>>([]);

  const items = Children.toArray(children).filter(isValidElement<TabProps>);
  const safeIndex = items.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), items.length - 1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || items.length < 2) return;
    const onDesignToggle = () => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, [items.length]);

  const moveFocus = (next: number) => {
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus((safeIndex + 1) % items.length);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus((safeIndex - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveFocus(items.length - 1);
    }
  };

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="tabs"
    >
      <div
        role="tablist"
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '8px',
          marginBottom: '12px',
        }}
      >
        {items.map((item, idx) => {
          const active = idx === safeIndex;
          return (
            <button
              key={idx}
              ref={(el) => {
                tabRefs.current[idx] = el ?? undefined;
              }}
              type="button"
              role="tab"
              id={\`\${baseId}-tab-\${idx}\`}
              aria-selected={active}
              aria-controls={\`\${baseId}-panel-\${idx}\`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveIndex(idx)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: active ? 600 : 500,
                backgroundColor: active ? '#111827' : 'transparent',
                color: active ? '#ffffff' : 'inherit',
              }}
            >
              {item.props.label}
            </button>
          );
        })}
      </div>
      {items.map((item, idx) => {
        const active = idx === safeIndex;
        return (
          <div
            key={idx}
            role="tabpanel"
            id={\`\${baseId}-panel-\${idx}\`}
            aria-labelledby={\`\${baseId}-tab-\${idx}\`}
            hidden={!active}
          >
            {active ? item : undefined}
          </div>
        );
      })}
    </div>
  );
}
`;

const TABS_JS = `import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';

export function Tab({ children, className }) {
  return <div className={className}>{children}</div>;
}

export function Tabs({ children, defaultIndex = 0, className }) {
  const baseId = useId();
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const rootRef = useRef(undefined);
  const tabRefs = useRef([]);

  const items = Children.toArray(children).filter((child) => isValidElement(child));
  const safeIndex = items.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), items.length - 1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || items.length < 2) return;
    const onDesignToggle = () => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    };
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, [items.length]);

  const moveFocus = (next) => {
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (event) => {
    if (items.length === 0) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveFocus((safeIndex + 1) % items.length);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveFocus((safeIndex - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveFocus(items.length - 1);
    }
  };

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      className={className}
      data-kc-interactive="tabs"
    >
      <div
        role="tablist"
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '8px',
          marginBottom: '12px',
        }}
      >
        {items.map((item, idx) => {
          const active = idx === safeIndex;
          return (
            <button
              key={idx}
              ref={(el) => {
                tabRefs.current[idx] = el ?? undefined;
              }}
              type="button"
              role="tab"
              id={\`\${baseId}-tab-\${idx}\`}
              aria-selected={active}
              aria-controls={\`\${baseId}-panel-\${idx}\`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveIndex(idx)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: active ? 600 : 500,
                backgroundColor: active ? '#111827' : 'transparent',
                color: active ? '#ffffff' : 'inherit',
              }}
            >
              {item.props.label}
            </button>
          );
        })}
      </div>
      {items.map((item, idx) => {
        const active = idx === safeIndex;
        return (
          <div
            key={idx}
            role="tabpanel"
            id={\`\${baseId}-panel-\${idx}\`}
            aria-labelledby={\`\${baseId}-tab-\${idx}\`}
            hidden={!active}
          >
            {active ? item : undefined}
          </div>
        );
      })}
    </div>
  );
}
`;

export function buildTabsTemplate(typescript: boolean): string {
  return typescript ? TABS_TS : TABS_JS;
}
