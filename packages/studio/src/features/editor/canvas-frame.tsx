// The project's page inside the Canvas (SPEC-04 M-RN R-RN-21 to R-RN-24, SPEC-05 S-100, S-102).
import type { Frame } from '@kumicraft/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CanvasDropLayer } from '../dnd/canvas-drop-layer.tsx';
import { LayerMenu } from '../layer-menu/layer-menu.tsx';
import {
  type BridgeChannel,
  bridgeChannels,
  studioBridgeChannel,
} from '../selection/bridge-channel.ts';
import { type CanvasMode, useSelectionStore } from '../selection/selection-store.ts';

/** S-100: the project's page runs scripts but cannot navigate the Studio window. */
export const IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads';

/** R-RN-24: a loaded page whose Bridge says nothing for this long gets a warning. */
export const BRIDGE_READY_TIMEOUT_MS = 10_000;

/** R-RN-21: the page the user was on, so a restarted dev server opens the same page. */
function pageUrl(origin: string, route?: string): string {
  const current = route ?? useSelectionStore.getState().currentRoute;
  return current.startsWith('/') ? `${origin}${current}` : `${origin}/`;
}

export function computeIframeSrc(origin: string, draftFile?: string, route?: string): string {
  if (draftFile) {
    return `${origin}/__kumicraft/draft?file=${encodeURIComponent(draftFile)}`;
  }
  return pageUrl(origin, route);
}

/**
 * Attaches the channel when the page loads. The page is on another origin, so the Studio never
 * reads its document (S-102); a mode change only sends `set-mode`, it does not reattach.
 */
/** The frame's own channel (M-MF); a frame outside the multi-frame Canvas uses the shared one. */
function channelOfFrame(openFrameId: string | undefined): BridgeChannel {
  return openFrameId === undefined ? studioBridgeChannel : bridgeChannels.get(openFrameId);
}

function useIframeBridge(
  iframeRef: { readonly current?: HTMLIFrameElement | undefined },
  origin: string,
  nonce: string | undefined,
  mode: CanvasMode,
  openFrameId: string | undefined,
  onBridgeSilent: () => void,
) {
  const modeRef = useRef(mode);
  const silentRef = useRef(onBridgeSilent);
  useEffect(() => {
    modeRef.current = mode;
    silentRef.current = onBridgeSilent;
  });

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !nonce) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = channelOfFrame(openFrameId);

    if (iframe.contentWindow) channel.attach(iframe.contentWindow, origin, nonce);

    const handleLoad = () => {
      if (!iframe.contentWindow) return;
      channel.setMode(modeRef.current);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!useSelectionStore.getState().bridgeReady) silentRef.current();
      }, BRIDGE_READY_TIMEOUT_MS);
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      iframe.removeEventListener('load', handleLoad);
      channel.detach();
    };
  }, [iframeRef, origin, nonce, openFrameId]);

  useEffect(() => {
    const channel = channelOfFrame(openFrameId);
    channel.setMode(mode);
  }, [mode, openFrameId]);
}

function BridgeSilentBanner({ logTail }: { readonly logTail: readonly string[] }) {
  const { t } = useTranslation();
  const [showLog, setShowLog] = useState(false);
  return (
    <div
      role="alert"
      data-testid="canvas-bridge-warning"
      className="absolute top-3 left-1/2 z-10 flex w-[min(32rem,90%)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-amber-500/40 bg-card-solid/95 p-3 text-xs shadow-xl"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink">{t('editor.bridgeSilent')}</span>
        <button
          type="button"
          data-testid="canvas-bridge-log-btn"
          onClick={() => {
            setShowLog((v) => !v);
          }}
          className="shrink-0 rounded border border-border bg-field px-2 py-0.5 text-ink hover:bg-field-hover"
        >
          {t('editor.showLog')}
        </button>
      </div>
      {showLog && (
        <pre
          data-testid="canvas-bridge-log"
          className="max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-ink-soft"
        >
          {logTail.join('\n')}
        </pre>
      )}
    </div>
  );
}

export type IframeFrameProps = {
  readonly origin: string;
  readonly frame: Frame;
  readonly zoom: number;
  readonly nonce?: string | undefined;
  readonly mode: CanvasMode;
  readonly logTail: readonly string[];
  readonly draftFile?: string | undefined;
  readonly openFrameId?: string | undefined;
  readonly route?: string | undefined;
};

type ZoomedIframeBoxProps = {
  readonly frame: Frame;
  readonly zoom: number;
  readonly src: string;
  readonly iframeRef: { current?: HTMLIFrameElement | undefined };
};

function ZoomedIframeBox({ frame, zoom, src, iframeRef }: ZoomedIframeBoxProps) {
  return (
    <div
      data-testid="canvas-zoom-box"
      className="relative"
      style={{
        width: `${String(frame.width * zoom)}px`,
        height: `${String(frame.height * zoom)}px`,
      }}
    >
      <div
        className="relative origin-top-left transition-transform duration-150"
        style={{ transform: `scale(${String(zoom)})` }}
      >
        <iframe
          ref={(el) => {
            iframeRef.current = el ?? undefined;
          }}
          src={src}
          sandbox={IFRAME_SANDBOX}
          title={frame.label}
          data-testid="canvas-iframe"
          className="overflow-auto rounded-lg border border-border bg-white shadow-2xl"
          style={{
            width: `${String(frame.width)}px`,
            height: `${String(frame.height)}px`,
          }}
        />
        <CanvasDropLayer iframeRef={iframeRef} zoom={zoom} />
      </div>
      <LayerMenu boxWidth={frame.width * zoom} boxHeight={frame.height * zoom} />
    </div>
  );
}

/** Mount it with a key of origin and nonce: a restarted dev server gets a fresh page (R-RN-22). */
export function IframeFrame({
  origin,
  frame,
  zoom,
  nonce,
  mode,
  logTail,
  draftFile,
  openFrameId,
  route,
}: IframeFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(undefined);
  const [target, setTarget] = useState(() => ({
    origin,
    draftFile,
    src: computeIframeSrc(origin, draftFile, route),
  }));
  if (target.origin !== origin || target.draftFile !== draftFile) {
    setTarget({
      origin,
      draftFile,
      src: computeIframeSrc(origin, draftFile, route),
    });
  }
  const [silent, setSilent] = useState(false);
  const bridgeReady = useSelectionStore((s) => s.bridgeReady);
  useIframeBridge(iframeRef, origin, nonce, mode, openFrameId, () => {
    setSilent(true);
  });

  return (
    <>
      {silent && !bridgeReady && <BridgeSilentBanner logTail={logTail} />}
      <ZoomedIframeBox frame={frame} zoom={zoom} src={target.src} iframeRef={iframeRef} />
    </>
  );
}
