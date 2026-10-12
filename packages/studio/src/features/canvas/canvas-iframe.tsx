import { type Frame, generateThemeCss } from '@reactcraft/model';
import tailwindRuntimeUrl from '@tailwindcss/browser?url';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useEditorStore } from '../../store/editor-store.ts';
import { CanvasPortal } from './canvas-portal.tsx';

export function syncIframeHead(doc: Document, themeCss: string): void {
  const existingScript = doc.getElementById('rc-tw-runtime') ?? undefined;
  if (existingScript === undefined) {
    const script = doc.createElement('script');
    script.id = 'rc-tw-runtime';
    script.src = tailwindRuntimeUrl;
    doc.head.appendChild(script);
  }

  // Not `instanceof`: the iframe has its own HTMLStyleElement class, so that check is always false.
  let themeStyle = doc.querySelector<HTMLStyleElement>('style#rc-theme') ?? undefined;
  if (themeStyle === undefined) {
    themeStyle = doc.createElement('style');
    themeStyle.id = 'rc-theme';
    themeStyle.setAttribute('type', 'text/tailwindcss');
    doc.head.appendChild(themeStyle);
  }
  if (themeStyle.textContent !== themeCss) {
    themeStyle.textContent = themeCss;
  }

  const existingHelpers = doc.getElementById('rc-helpers') ?? undefined;
  if (existingHelpers === undefined) {
    const helperStyle = doc.createElement('style');
    helperStyle.id = 'rc-helpers';
    helperStyle.textContent = `
      html, body { margin: 0; padding: 0; min-height: 100%; }
      * { box-sizing: border-box; }
    `;
    doc.head.appendChild(helperStyle);
  }
}

function useIframeNavigationBlocker(iframe: HTMLIFrameElement | undefined): void {
  useEffect(() => {
    const doc = iframe?.contentDocument ?? undefined;
    if (doc === undefined) return undefined;

    const handleLinkClick = (e: MouseEvent) => {
      // The iframe has its own Element class, so test against its window, not ours.
      const ElementClass = doc.defaultView?.Element;
      const target =
        ElementClass !== undefined && e.target instanceof ElementClass ? e.target : undefined;
      if (target?.closest('a')) {
        e.preventDefault();
      }
    };

    const handleSubmit = (e: Event) => {
      e.preventDefault();
    };

    doc.addEventListener('click', handleLinkClick, true);
    doc.addEventListener('auxclick', handleLinkClick, true);
    doc.addEventListener('submit', handleSubmit, true);

    return () => {
      doc.removeEventListener('click', handleLinkClick, true);
      doc.removeEventListener('auxclick', handleLinkClick, true);
      doc.removeEventListener('submit', handleSubmit, true);
    };
  }, [iframe]);
}

function useIframeAutoHeight(
  iframe: HTMLIFrameElement | undefined,
  minHeight: number,
  onContentHeight?: (height: number) => void,
): number {
  const [contentHeight, setContentHeight] = useState<number>(minHeight);

  useEffect(() => {
    const doc = iframe?.contentDocument ?? undefined;
    if (doc?.body === undefined) return undefined;

    const target = doc.body;
    const updateSize = () => {
      const scrollH = target.scrollHeight;
      const clientH = target.clientHeight;
      const measured = Math.max(scrollH, clientH);
      const newH = Math.max(minHeight, measured);
      setContentHeight(newH);
      onContentHeight?.(newH);
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(target);
    updateSize();

    return () => {
      observer.disconnect();
    };
  }, [iframe, minHeight, onContentHeight]);

  return contentHeight;
}

function useIframeThemeSync(
  iframe: HTMLIFrameElement | undefined,
  themeCss: string,
  setMountNode: (node: HTMLElement) => void,
): void {
  useEffect(() => {
    if (iframe === undefined) return undefined;

    const setup = () => {
      const doc = iframe.contentDocument ?? undefined;
      if (doc?.body === undefined) return;
      syncIframeHead(doc, themeCss);
      setMountNode(doc.body);
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      setup();
    } else {
      iframe.addEventListener('load', setup);
      return () => {
        iframe.removeEventListener('load', setup);
      };
    }
    return undefined;
  }, [iframe, themeCss, setMountNode]);

  useEffect(() => {
    const doc = iframe?.contentDocument ?? undefined;
    if (doc?.body !== undefined) {
      syncIframeHead(doc, themeCss);
    }
  }, [iframe, themeCss]);
}

export function CanvasIframe({
  children,
  frame,
  onContentHeight,
  title = 'Canvas Preview',
}: {
  readonly children: ReactNode;
  readonly frame?: Frame | undefined;
  readonly onContentHeight?: ((height: number) => void) | undefined;
  readonly title?: string | undefined;
}) {
  const [iframe, setIframe] = useState<HTMLIFrameElement>();
  const [mountNode, setMountNode] = useState<HTMLElement>();
  const tokens = useEditorStore((s) => s.document?.tokens);
  const themeCss = tokens !== undefined ? generateThemeCss(tokens) : '';
  const minHeight = frame?.height ?? 900;
  const frameWidth = frame?.width ?? 1440;
  const contentHeight = useIframeAutoHeight(iframe, minHeight, onContentHeight);

  useIframeNavigationBlocker(iframe);
  useIframeThemeSync(iframe, themeCss, setMountNode);

  return (
    <>
      <iframe
        ref={(element) => {
          setIframe(element ?? undefined);
        }}
        title={title}
        data-testid="canvas-iframe"
        style={{
          width: `${String(frameWidth)}px`,
          height: `${String(contentHeight)}px`,
          display: 'block',
          border: 0,
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      />
      {mountNode !== undefined && <CanvasPortal container={mountNode}>{children}</CanvasPortal>}
    </>
  );
}
