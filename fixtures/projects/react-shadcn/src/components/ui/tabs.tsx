import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type TabsCtx = {
  readonly value: string;
  readonly onValueChange: (next: string) => void;
};

const TabsContext = createContext<TabsCtx | undefined>(undefined);

export interface TabsProps {
  readonly defaultValue?: string;
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
  readonly className?: string;
  readonly children?: ReactNode;
}

export function Tabs({
  defaultValue = '',
  value,
  onValueChange,
  className = '',
  children,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value !== undefined ? value : internal;
  const setNext = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };
  return (
    <TabsContext.Provider value={{ value: current, onValueChange: setNext }}>
      <div className={className} data-kc-shadcn="tabs">
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className = '',
  children,
}: {
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-md bg-slate-100 p-1 ${className}`}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className = '',
  children,
}: {
  readonly value: string;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx?.onValueChange(value)}
      className={`px-3 py-1.5 text-sm font-medium rounded ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className = '',
  children,
}: {
  readonly value: string;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  const ctx = useContext(TabsContext);
  if (ctx !== undefined && ctx.value !== value) return undefined;
  return (
    <div role="tabpanel" className={`mt-2 ${className}`}>
      {children}
    </div>
  );
}
