import { generateThemeCss } from '@reactcraft/model';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useEditorStore } from '../../store/editor-store.ts';
import { CanvasPortal } from './canvas-portal.tsx';

function syncIframeHead(doc: Document, themeCss: string) {
  let themeStyle = doc.getElementById('rc-theme');
  if (!themeStyle) {
    themeStyle = doc.createElement('style');
    themeStyle.id = 'rc-theme';
    doc.head.appendChild(themeStyle);
  }
  if (themeStyle.textContent !== themeCss) {
    themeStyle.textContent = themeCss;
  }

  let helperStyle = doc.getElementById('rc-helpers');
  if (!helperStyle) {
    helperStyle = doc.createElement('style');
    helperStyle.id = 'rc-helpers';
    helperStyle.textContent = `
      html, body { margin: 0; padding: 0; min-height: 100%; }
      * { box-sizing: border-box; }
      a { pointer-events: none; }
      form { pointer-events: none; }
    `;
    doc.head.appendChild(helperStyle);
  }
}

function copyParentStyles(doc: Document) {
  const styles = document.querySelectorAll('link[rel="stylesheet"], style');
  styles.forEach((tag) => {
    if (tag.id !== 'rc-theme' && tag.id !== 'rc-helpers') {
      doc.head.appendChild(tag.cloneNode(true));
    }
  });
}

export function CanvasIframe({
  children,
  title = 'Canvas Preview',
}: {
  readonly children: ReactNode;
  readonly title?: string;
}) {
  const [iframe, setIframe] = useState<HTMLIFrameElement>();
  const [mountNode, setMountNode] = useState<HTMLElement>();
  const tokens = useEditorStore((s) => s.document?.tokens);
  const themeCss = tokens !== undefined ? generateThemeCss(tokens) : '';

  useEffect(() => {
    if (iframe === undefined) return undefined;

    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      copyParentStyles(doc);
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
  }, [iframe, themeCss]);

  useEffect(() => {
    const doc = iframe?.contentDocument;
    if (doc?.body) {
      syncIframeHead(doc, themeCss);
    }
  }, [iframe, themeCss]);

  return (
    <>
      <iframe
        ref={(element) => {
          setIframe(element ?? undefined);
        }}
        title={title}
        data-testid="canvas-iframe"
        className="size-full min-h-[inherit] border-0 bg-white"
      />
      {mountNode !== undefined && <CanvasPortal container={mountNode}>{children}</CanvasPortal>}
    </>
  );
}
