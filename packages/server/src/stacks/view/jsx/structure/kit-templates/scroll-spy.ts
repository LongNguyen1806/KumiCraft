// ScrollSpy kit (K9.8-1 TK-80). QA: no element of its own (the menu keeps its own layout rules),
// and only in-page `#id` links are marked: page links belong to the project's router (NavLink sets
// aria-current itself), so the kit never touches them.
const SCROLL_SPY_TS = `import {
  type ReactNode,
  type Ref,
  type RefCallback,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
} from 'react';

export type ScrollSpyProps = {
  readonly offset?: number;
  readonly children?: ReactNode;
};

function markActive(links: readonly HTMLAnchorElement[], activeId: string | undefined): void {
  for (const link of links) {
    const isActive = activeId !== undefined && link.getAttribute('href') === '#' + activeId;
    if (isActive) {
      link.setAttribute('data-selected', 'true');
      link.setAttribute('aria-current', 'true');
    } else if (link.getAttribute('data-selected') === 'true') {
      link.removeAttribute('data-selected');
      link.removeAttribute('aria-current');
    }
  }
}

/** Marks the in-page link of the section being read (data-selected, aria-current) inside its one child. */
export function ScrollSpy({ offset = 120, children }: ScrollSpyProps) {
  const rootRef = useRef<HTMLElement | undefined>(undefined);

  useEffect(() => {
    const container = rootRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).filter(
      (a) => (a.getAttribute('href') ?? '').length > 1,
    );
    const sections = links
      .map((a) => document.getElementById((a.getAttribute('href') ?? '').slice(1)))
      .filter((el): el is HTMLElement => el instanceof HTMLElement);
    if (sections.length === 0) return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, Math.abs(entry.boundingClientRect.top));
          else visible.delete(entry.target.id);
        }
        let bestId: string | undefined;
        let bestTop = Infinity;
        for (const [id, top] of visible) {
          if (top < bestTop) {
            bestTop = top;
            bestId = id;
          }
        }
        if (bestId !== undefined) markActive(links, bestId);
      },
      { rootMargin: '-' + String(offset) + 'px 0px -40% 0px', threshold: [0, 0.25, 0.5] },
    );
    for (const section of sections) observer.observe(section);
    return () => {
      observer.disconnect();
    };
  }, [offset]);

  if (!isValidElement<{ ref?: Ref<HTMLElement> }>(children)) return <>{children}</>;
  const ownRef = children.props.ref;
  const setRef: RefCallback<HTMLElement> = (el) => {
    rootRef.current = el ?? undefined;
    if (typeof ownRef === 'function') ownRef(el);
    else if (ownRef && 'current' in ownRef) Object.assign(ownRef, { current: el });
  };
  return cloneElement(children, { ref: setRef });
}
`;

const SCROLL_SPY_JS = `import { cloneElement, isValidElement, useEffect, useRef } from 'react';

function markActive(links, activeId) {
  for (const link of links) {
    const isActive = activeId !== undefined && link.getAttribute('href') === '#' + activeId;
    if (isActive) {
      link.setAttribute('data-selected', 'true');
      link.setAttribute('aria-current', 'true');
    } else if (link.getAttribute('data-selected') === 'true') {
      link.removeAttribute('data-selected');
      link.removeAttribute('aria-current');
    }
  }
}

/** Marks the in-page link of the section being read (data-selected, aria-current) inside its one child. */
export function ScrollSpy({ offset = 120, children }) {
  const rootRef = useRef(undefined);

  useEffect(() => {
    const container = rootRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;
    const links = Array.from(container.querySelectorAll('a[href^="#"]')).filter(
      (a) => (a.getAttribute('href') ?? '').length > 1,
    );
    const sections = links
      .map((a) => document.getElementById((a.getAttribute('href') ?? '').slice(1)))
      .filter((el) => el instanceof HTMLElement);
    if (sections.length === 0) return;
    const visible = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, Math.abs(entry.boundingClientRect.top));
          else visible.delete(entry.target.id);
        }
        let bestId;
        let bestTop = Infinity;
        for (const [id, top] of visible) {
          if (top < bestTop) {
            bestTop = top;
            bestId = id;
          }
        }
        if (bestId !== undefined) markActive(links, bestId);
      },
      { rootMargin: '-' + String(offset) + 'px 0px -40% 0px', threshold: [0, 0.25, 0.5] },
    );
    for (const section of sections) observer.observe(section);
    return () => {
      observer.disconnect();
    };
  }, [offset]);

  if (!isValidElement(children)) return <>{children}</>;
  const ownRef = children.props.ref;
  return cloneElement(children, {
    ref: (el) => {
      rootRef.current = el ?? undefined;
      if (typeof ownRef === 'function') ownRef(el);
      else if (ownRef && 'current' in ownRef) ownRef.current = el;
    },
  });
}
`;

export function buildScrollSpyTemplate(typescript: boolean): string {
  return typescript ? SCROLL_SPY_TS : SCROLL_SPY_JS;
}
