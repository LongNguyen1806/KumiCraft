import type { Frame } from '@reactcraft/model';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CanvasScaleProvider } from '../canvas/canvas-scale-context.tsx';
import { CanvasViewport } from '../canvas/canvas-viewport.tsx';

const STAGE_PADDING = 64;

/** Scale that fits `frameWidth` into `available` pixels, never above 100 %. */
export const fitScale = (available: number, frameWidth: number): number =>
  available <= 0 ? 1 : Math.min(1, Math.max(0.05, (available - STAGE_PADDING) / frameWidth));

type CanvasAreaProps = {
  readonly frame: Frame;
  readonly scale: number;
  readonly onWidth: (width: number) => void;
};

function FrameHeader({ frame, scale }: { readonly frame: Frame; readonly scale: number }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center justify-between px-1 text-ink-faint"
      style={{ width: Math.round(frame.width * scale) }}
    >
      <span className="font-medium text-ink">{frame.label}</span>
      <span className="font-mono text-xs" data-testid="frame-size">
        {t('editor.frameSize', { width: frame.width, height: frame.height })}
      </span>
    </div>
  );
}

function FrameViewportMat({
  frame,
  scale,
  effectiveHeight,
  onContentHeight,
}: {
  readonly frame: Frame;
  readonly scale: number;
  readonly effectiveHeight: number;
  readonly onContentHeight: (height: number) => void;
}) {
  return (
    <div className="flex justify-center px-8 pt-9 pb-14">
      <div className="grid gap-2.5">
        <FrameHeader frame={frame} scale={scale} />
        <div
          className="w-max"
          style={{
            width: Math.round(frame.width * scale),
            height: Math.round(effectiveHeight * scale),
          }}
        >
          <div
            style={{
              transform: `scale(${String(scale)})`,
              transformOrigin: '0 0',
              width: frame.width,
            }}
          >
            <div
              className="overflow-hidden rounded-[14px] bg-white shadow-[0_2px_4px_rgb(60_52_30/0.06),0_24px_48px_rgb(60_52_30/0.12)]"
              style={{ width: frame.width, minHeight: frame.height, height: effectiveHeight }}
              data-testid="frame"
            >
              <CanvasViewport frame={frame} onContentHeight={onContentHeight} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The dotted mat with the active frame, zoomed to fit (SPEC-04.1 section 6.2). The page itself is
 * rendered inside the frame by the Canvas Renderer of WP-1.07.
 */
export function CanvasArea({ frame, scale, onWidth }: CanvasAreaProps) {
  const { t } = useTranslation();
  const [area, setArea] = useState<HTMLElement>();
  const [contentHeight, setContentHeight] = useState<number>(frame.height);

  useEffect(() => {
    if (area === undefined) return undefined;
    const observer = new ResizeObserver(() => {
      onWidth(area.clientWidth);
    });
    observer.observe(area);
    onWidth(area.clientWidth);
    return () => {
      observer.disconnect();
    };
  }, [area, onWidth]);

  const effectiveHeight = Math.max(frame.height, contentHeight);

  return (
    <CanvasScaleProvider scale={scale}>
      <main
        ref={(element) => {
          setArea(element ?? undefined);
        }}
        aria-label={t('editor.canvas')}
        data-testid="editor"
        className="relative min-h-0 min-w-0 overflow-auto rounded-panel bg-card-solid/35 bg-[radial-gradient(rgb(60_52_30/0.14)_1px,transparent_1px)] bg-size-[18px_18px]"
      >
        <FrameViewportMat
          frame={frame}
          scale={scale}
          effectiveHeight={effectiveHeight}
          onContentHeight={setContentHeight}
        />
      </main>
    </CanvasScaleProvider>
  );
}
