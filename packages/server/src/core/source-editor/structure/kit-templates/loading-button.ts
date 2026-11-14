const LOADING_BUTTON_TS = `import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

/** The demo pause runs only on the KumiCraft Canvas/Preview: there, and only there, elements carry data-rc-loc. */
function insideKumiCraft(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[data-rc-loc]') instanceof Element;
}

export type LoadingButtonProps = {
  readonly loading?: boolean;
  readonly loadingText?: string;
  readonly demo?: boolean;
  readonly as?: 'button' | 'a';
  readonly href?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export function LoadingButton({
  loading,
  loadingText,
  demo = true,
  as = 'button',
  disabled = false,
  className,
  onClick,
  children,
  style,
  ...rest
}: LoadingButtonProps) {
  const [demoLoading, setDemoLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lockedWidth, setLockedWidth] = useState<number | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  const elRef = useRef<HTMLElement | undefined>(undefined);

  const active = loading ?? (demoLoading || previewLoading);

  useEffect(() => {
    const onPreview = (ev: Event) => {
      const detail = (ev as CustomEvent<{ active: boolean; loc?: string }>).detail;
      const el = elRef.current;
      if (!el) return;
      if (!detail.loc || el.getAttribute('data-rc-loc') === detail.loc) {
        setPreviewLoading(detail.active);
      }
    };
    window.addEventListener('kumicraft:loading-preview', onPreview);
    return () => {
      window.removeEventListener('kumicraft:loading-preview', onPreview);
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (active || disabled) {
      e.preventDefault();
      return;
    }
    const width = elRef.current?.getBoundingClientRect().width;
    if (width && width > 0) setLockedWidth(Math.ceil(width));
    if (loading === undefined && demo && insideKumiCraft()) {
      setDemoLoading(true);
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setDemoLoading(false);
        setLockedWidth(undefined);
      }, 1500);
    }
    onClick?.(e);
  };

  const mergedStyle = {
    ...style,
    ...(lockedWidth ? { minWidth: \`\${lockedWidth}px\` } : {}),
  };

  const spinner = active ? (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      style={{ marginRight: '8px', verticalAlign: '-2px' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  ) : undefined;

  if (as === 'a') {
    return (
      <a
        ref={(el) => {
          elRef.current = el ?? undefined;
        }}
        href={rest.href}
        className={className}
        style={mergedStyle}
        aria-busy={active ? 'true' : undefined}
        aria-disabled={active || disabled ? 'true' : undefined}
      >
        {spinner}
        <span>{active && loadingText ? loadingText : children}</span>
      </a>
    );
  }

  return (
    <button
      {...rest}
      ref={(el) => {
        elRef.current = el ?? undefined;
      }}
      type={rest.type ?? 'button'}
      className={className}
      style={mergedStyle}
      disabled={disabled || active}
      aria-busy={active ? 'true' : undefined}
      aria-disabled={disabled || active ? 'true' : undefined}
      onClick={handleClick}
    >
      {spinner}
      <span>{active && loadingText ? loadingText : children}</span>
    </button>
  );
}
`;

const LOADING_BUTTON_JS = `import { useEffect, useRef, useState } from 'react';

/** The demo pause runs only on the KumiCraft Canvas/Preview: there, and only there, elements carry data-rc-loc. */
function insideKumiCraft() {
  return typeof document !== 'undefined' && document.querySelector('[data-rc-loc]') instanceof Element;
}

export function LoadingButton({
  loading,
  loadingText,
  demo = true,
  as = 'button',
  disabled = false,
  className,
  onClick,
  children,
  style,
  ...rest
}) {
  const [demoLoading, setDemoLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lockedWidth, setLockedWidth] = useState(undefined);
  const timerRef = useRef(undefined);
  const elRef = useRef(undefined);
  const active = loading ?? (demoLoading || previewLoading);

  useEffect(() => {
    const onPreview = (ev) => {
      const detail = ev.detail;
      const el = elRef.current;
      if (!el) return;
      if (!detail?.loc || el.getAttribute('data-rc-loc') === detail.loc) {
        setPreviewLoading(Boolean(detail?.active));
      }
    };
    window.addEventListener('kumicraft:loading-preview', onPreview);
    return () => {
      window.removeEventListener('kumicraft:loading-preview', onPreview);
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = (e) => {
    if (active || disabled) {
      e.preventDefault();
      return;
    }
    const width = elRef.current?.getBoundingClientRect().width;
    if (width && width > 0) setLockedWidth(Math.ceil(width));
    if (loading === undefined && demo && insideKumiCraft()) {
      setDemoLoading(true);
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setDemoLoading(false);
        setLockedWidth(undefined);
      }, 1500);
    }
    onClick?.(e);
  };

  const mergedStyle = {
    ...style,
    ...(lockedWidth ? { minWidth: \`\${lockedWidth}px\` } : {}),
  };

  const spinner = active ? (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      style={{ marginRight: '8px', verticalAlign: '-2px' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  ) : undefined;

  if (as === 'a') {
    return (
      <a
        ref={(el) => {
          elRef.current = el ?? undefined;
        }}
        href={rest.href}
        className={className}
        style={mergedStyle}
        aria-busy={active ? 'true' : undefined}
        aria-disabled={active || disabled ? 'true' : undefined}
      >
        {spinner}
        <span>{active && loadingText ? loadingText : children}</span>
      </a>
    );
  }

  return (
    <button
      {...rest}
      ref={(el) => {
        elRef.current = el ?? undefined;
      }}
      type={rest.type ?? 'button'}
      className={className}
      style={mergedStyle}
      disabled={disabled || active}
      aria-busy={active ? 'true' : undefined}
      aria-disabled={disabled || active ? 'true' : undefined}
      onClick={handleClick}
    >
      {spinner}
      <span>{active && loadingText ? loadingText : children}</span>
    </button>
  );
}
`;

export function buildLoadingButtonTemplate(typescript: boolean): string {
  return typescript ? LOADING_BUTTON_TS : LOADING_BUTTON_JS;
}
