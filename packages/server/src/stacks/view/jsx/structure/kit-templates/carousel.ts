const CAROUSEL_TS = `import { Children, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type CarouselProps = {
  children?: ReactNode;
  autoPlay?: boolean;
  intervalMs?: number;
  className?: string;
};

export function Carousel({
  children,
  autoPlay = false,
  intervalMs = 4000,
  className,
}: CarouselProps) {
  const slides = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | undefined>(undefined);
  const safeIndex = slides.length === 0 ? 0 : Math.min(Math.max(index, 0), slides.length - 1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || slides.length < 2) return;
    const onDesignToggle = () => setIndex((prev) => (prev + 1) % slides.length);
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, [slides.length]);

  useEffect(() => {
    if (!autoPlay || slides.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [autoPlay, intervalMs, slides.length]);

  const go = (delta: number) => {
    if (slides.length === 0) return;
    setIndex((prev) => (prev + delta + slides.length) % slides.length);
  };

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      role="region"
      aria-roledescription="carousel"
      className={className}
      data-kc-interactive="carousel"
    >
      <div style={{ minHeight: '80px' }}>{slides[safeIndex]}</div>
      {slides.length > 1 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '12px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Prev
          </button>
          <div style={{ display: 'flex', gap: '6px' }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={\`Slide \${idx + 1}\`}
                aria-current={idx === safeIndex}
                onClick={() => setIndex(idx)}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  backgroundColor: idx === safeIndex ? '#2563eb' : '#d1d5db',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Next
          </button>
        </div>
      ) : undefined}
    </div>
  );
}
`;

const CAROUSEL_JS = `import { Children, useEffect, useRef, useState } from 'react';

export function Carousel({ children, autoPlay = false, intervalMs = 4000, className }) {
  const slides = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const rootRef = useRef(undefined);
  const safeIndex = slides.length === 0 ? 0 : Math.min(Math.max(index, 0), slides.length - 1);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || slides.length < 2) return;
    const onDesignToggle = () => setIndex((prev) => (prev + 1) % slides.length);
    el.addEventListener('kumicraft:design-toggle', onDesignToggle);
    return () => el.removeEventListener('kumicraft:design-toggle', onDesignToggle);
  }, [slides.length]);

  useEffect(() => {
    if (!autoPlay || slides.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [autoPlay, intervalMs, slides.length]);

  const go = (delta) => {
    if (slides.length === 0) return;
    setIndex((prev) => (prev + delta + slides.length) % slides.length);
  };

  return (
    <div
      ref={(el) => {
        rootRef.current = el ?? undefined;
      }}
      role="region"
      aria-roledescription="carousel"
      className={className}
      data-kc-interactive="carousel"
    >
      <div style={{ minHeight: '80px' }}>{slides[safeIndex]}</div>
      {slides.length > 1 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '12px',
            gap: '8px',
          }}
        >
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Prev
          </button>
          <div style={{ display: 'flex', gap: '6px' }}>
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={\`Slide \${idx + 1}\`}
                aria-current={idx === safeIndex}
                onClick={() => setIndex(idx)}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  backgroundColor: idx === safeIndex ? '#2563eb' : '#d1d5db',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            Next
          </button>
        </div>
      ) : undefined}
    </div>
  );
}
`;

export function buildCarouselTemplate(typescript: boolean): string {
  return typescript ? CAROUSEL_TS : CAROUSEL_JS;
}
