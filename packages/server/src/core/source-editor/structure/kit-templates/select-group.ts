// SelectGroup kit (K9.8-1 TK-73). QA: the group and its panels add no element of their own, so
// the container keeps its `space-y-*`, `divide-*`, `first:`/`last:` and `parent > child` rules.
const SELECT_GROUP_TS = `import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type SelectGroupMode = 'single' | 'multiple';

type SelectGroupContextValue = {
  readonly mode: SelectGroupMode;
  readonly linked: boolean;
  readonly selected: readonly string[];
  readonly toggleValue: (val: string) => void;
  readonly moveFocus: (current: string, step: number) => void;
  readonly register: (val: string, el: HTMLElement | undefined) => void;
};

const SelectGroupContext = createContext<SelectGroupContextValue | undefined>(undefined);

function toArray(val: string | readonly string[] | undefined): readonly string[] {
  if (val === undefined) return [];
  return typeof val === 'string' ? [val] : val;
}

/** The registered items in page order. */
function ordered(items: Map<string, HTMLElement>): [string, HTMLElement][] {
  return Array.from(items.entries()).sort(([, a], [, b]) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

function previewIndex(ev: Event): number | undefined {
  const detail: unknown = ev instanceof CustomEvent ? ev.detail : undefined;
  if (!(detail instanceof Object) || !('activeIndex' in detail)) return undefined;
  return typeof detail.activeIndex === 'number' ? detail.activeIndex : undefined;
}

export type SelectGroupProps = {
  readonly mode?: SelectGroupMode;
  readonly defaultValue?: string | readonly string[];
  readonly value?: string | readonly string[];
  readonly onValueChange?: (next: string | readonly string[]) => void;
  readonly linked?: boolean;
  readonly children?: ReactNode;
};

/** Shares the chosen item with its SelectItem and SelectPanel children; renders no element. */
export function SelectGroup({
  mode = 'single',
  defaultValue,
  value,
  onValueChange,
  linked = false,
  children,
}: SelectGroupProps) {
  const items = useRef(new Map<string, HTMLElement>());
  const [internal, setInternal] = useState<readonly string[]>(() => {
    const init = toArray(defaultValue);
    if (init.length > 0) return init;
    return linked ? ['item-1'] : [];
  });
  const selected = value !== undefined ? toArray(value) : internal;

  const choose = (next: readonly string[]) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(mode === 'multiple' ? next : (next[0] ?? ''));
  };
  const toggleValue = (itemVal: string) => {
    if (mode !== 'multiple') return choose([itemVal]);
    choose(selected.includes(itemVal) ? selected.filter((v) => v !== itemVal) : [...selected, itemVal]);
  };
  const moveFocus = (current: string, step: number) => {
    const list = ordered(items.current);
    const idx = list.findIndex(([val]) => val === current);
    if (idx < 0) return;
    const next = list[(idx + step + list.length) % list.length];
    if (next === undefined) return;
    next[1].focus();
    if (linked) choose([next[0]]);
  };
  const register = (val: string, el: HTMLElement | undefined) => {
    if (el === undefined) items.current.delete(val);
    else items.current.set(val, el);
  };

  // KumiCraft Canvas: "show choice N" is sent to an element around or inside this group.
  useEffect(() => {
    const onPreview = (ev: Event) => {
      const target = ev.target;
      const index = previewIndex(ev);
      if (!(target instanceof Node) || index === undefined) return;
      const list = ordered(items.current);
      if (!list.some(([, el]) => el.contains(target) || target.contains(el))) return;
      const entry = list[index];
      if (entry !== undefined) setInternal([entry[0]]);
    };
    document.addEventListener('kumicraft:select-preview', onPreview, true);
    return () => {
      document.removeEventListener('kumicraft:select-preview', onPreview, true);
    };
  }, []);

  return (
    <SelectGroupContext.Provider
      value={{ mode, linked, selected, toggleValue, moveFocus, register }}
    >
      {children}
    </SelectGroupContext.Provider>
  );
}

export type SelectItemProps<T extends ElementType = 'button'> = {
  readonly as?: T;
  readonly value: string;
  readonly className?: string;
  readonly selectedClassName?: string;
  readonly children?: ReactNode;
  readonly ref?: Ref<HTMLElement>;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'value' | 'className' | 'children'>;

/** One choice; keeps its own tag, classes and handlers, and marks itself data-selected. */
export function SelectItem<T extends ElementType = 'button'>({
  as,
  value,
  className,
  selectedClassName,
  children,
  ref,
  onClick,
  onKeyDown,
  ...rest
}: SelectItemProps<T>) {
  const ctx = useContext(SelectGroupContext);
  const Tag: ElementType = as ?? 'button';
  const isButton = Tag === 'button';
  const isSelected = ctx?.selected.includes(value) ?? false;
  const mergedClass = [className, isSelected ? selectedClassName : undefined]
    .filter(Boolean)
    .join(' ');
  const userClick: ((ev: MouseEvent<HTMLElement>) => void) | undefined = onClick;
  const userKeyDown: ((ev: KeyboardEvent<HTMLElement>) => void) | undefined = onKeyDown;

  const setRef: RefCallback<HTMLElement> = (el) => {
    ctx?.register(value, el ?? undefined);
    if (typeof ref === 'function') ref(el);
    else if (ref && 'current' in ref) Object.assign(ref, { current: el });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      ctx?.moveFocus(value, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      ctx?.moveFocus(value, -1);
    } else if (!isButton && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      ctx?.toggleValue(value);
    }
    userKeyDown?.(e);
  };

  return (
    <Tag
      {...rest}
      ref={setRef}
      type={isButton ? 'button' : undefined}
      className={mergedClass || undefined}
      data-selected={isSelected ? 'true' : undefined}
      role={ctx?.linked ? 'tab' : ctx?.mode === 'multiple' ? 'checkbox' : 'radio'}
      aria-selected={ctx?.linked ? isSelected : undefined}
      aria-checked={ctx?.linked ? undefined : isSelected}
      tabIndex={isButton || Tag === 'a' ? undefined : 0}
      onClick={(e: MouseEvent<HTMLElement>) => {
        ctx?.toggleValue(value);
        userClick?.(e);
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </Tag>
  );
}

export type SelectPanelProps = {
  readonly value: string;
  readonly children?: ReactNode;
};

/** Shows its content only while its choice is selected; renders no element of its own. */
export function SelectPanel({ value, children }: SelectPanelProps) {
  const ctx = useContext(SelectGroupContext);
  if (!(ctx?.selected.includes(value) ?? false)) return <></>;
  if (isValidElement<{ role?: string }>(children)) {
    const panel: ReactElement<{ role?: string }> = children;
    return cloneElement(panel, { role: 'tabpanel' });
  }
  return <>{children}</>;
}
`;

const SELECT_GROUP_JS = `import { cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState } from 'react';

const SelectGroupContext = createContext(undefined);

function toArray(val) {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

function ordered(items) {
  return Array.from(items.entries()).sort(([, a], [, b]) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

function previewIndex(ev) {
  const detail = ev instanceof CustomEvent ? ev.detail : undefined;
  return detail instanceof Object && typeof detail.activeIndex === 'number' ? detail.activeIndex : undefined;
}

/** Shares the chosen item with its SelectItem and SelectPanel children; renders no element. */
export function SelectGroup({ mode = 'single', defaultValue, value, onValueChange, linked = false, children }) {
  const items = useRef(new Map());
  const [internal, setInternal] = useState(() => {
    const init = toArray(defaultValue);
    if (init.length > 0) return init;
    return linked ? ['item-1'] : [];
  });
  const selected = value !== undefined ? toArray(value) : internal;

  const choose = (next) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(mode === 'multiple' ? next : (next[0] ?? ''));
  };
  const toggleValue = (itemVal) => {
    if (mode !== 'multiple') return choose([itemVal]);
    choose(selected.includes(itemVal) ? selected.filter((v) => v !== itemVal) : [...selected, itemVal]);
  };
  const moveFocus = (current, step) => {
    const list = ordered(items.current);
    const idx = list.findIndex(([val]) => val === current);
    if (idx < 0) return;
    const next = list[(idx + step + list.length) % list.length];
    if (next === undefined) return;
    next[1].focus();
    if (linked) choose([next[0]]);
  };
  const register = (val, el) => {
    if (el === undefined) items.current.delete(val);
    else items.current.set(val, el);
  };

  // KumiCraft Canvas: "show choice N" is sent to an element around or inside this group.
  useEffect(() => {
    const onPreview = (ev) => {
      const target = ev.target;
      const index = previewIndex(ev);
      if (!(target instanceof Node) || index === undefined) return;
      const list = ordered(items.current);
      if (!list.some(([, el]) => el.contains(target) || target.contains(el))) return;
      const entry = list[index];
      if (entry !== undefined) setInternal([entry[0]]);
    };
    document.addEventListener('kumicraft:select-preview', onPreview, true);
    return () => {
      document.removeEventListener('kumicraft:select-preview', onPreview, true);
    };
  }, []);

  return (
    <SelectGroupContext.Provider value={{ mode, linked, selected, toggleValue, moveFocus, register }}>
      {children}
    </SelectGroupContext.Provider>
  );
}

/** One choice; keeps its own tag, classes and handlers, and marks itself data-selected. */
export function SelectItem({ as, value, className, selectedClassName, children, ref, onClick, onKeyDown, ...rest }) {
  const ctx = useContext(SelectGroupContext);
  const Tag = as ?? 'button';
  const isButton = Tag === 'button';
  const isSelected = ctx?.selected.includes(value) ?? false;
  const mergedClass = [className, isSelected ? selectedClassName : undefined].filter(Boolean).join(' ');

  return (
    <Tag
      {...rest}
      ref={(el) => {
        ctx?.register(value, el ?? undefined);
        if (typeof ref === 'function') ref(el);
        else if (ref && 'current' in ref) Object.assign(ref, { current: el });
      }}
      type={isButton ? 'button' : undefined}
      className={mergedClass || undefined}
      data-selected={isSelected ? 'true' : undefined}
      role={ctx?.linked ? 'tab' : ctx?.mode === 'multiple' ? 'checkbox' : 'radio'}
      aria-selected={ctx?.linked ? isSelected : undefined}
      aria-checked={ctx?.linked ? undefined : isSelected}
      tabIndex={isButton || Tag === 'a' ? undefined : 0}
      onClick={(e) => {
        ctx?.toggleValue(value);
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          ctx?.moveFocus(value, 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          ctx?.moveFocus(value, -1);
        } else if (!isButton && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          ctx?.toggleValue(value);
        }
        onKeyDown?.(e);
      }}
    >
      {children}
    </Tag>
  );
}

/** Shows its content only while its choice is selected; renders no element of its own. */
export function SelectPanel({ value, children }) {
  const ctx = useContext(SelectGroupContext);
  if (!(ctx?.selected.includes(value) ?? false)) return <></>;
  if (isValidElement(children)) return cloneElement(children, { role: 'tabpanel' });
  return <>{children}</>;
}
`;

export function buildSelectGroupTemplate(typescript: boolean): string {
  return typescript ? SELECT_GROUP_TS : SELECT_GROUP_JS;
}
