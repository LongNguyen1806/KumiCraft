// Frame size select dropdown for the Canvas.
import type { Frame } from '@reactcraft/shared';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useCanvasViewStore } from './canvas-view-store.ts';

export type FrameSelectProps = {
  readonly frames?: readonly Frame[] | undefined;
  readonly activeId?: string | undefined;
  readonly onChange?: ((id: string) => void) | undefined;
};

export function FrameSelect(props: FrameSelectProps = {}) {
  const { t } = useTranslation();
  const storeFrames = useCanvasViewStore((s) => s.frames);
  const storeActiveId = useCanvasViewStore((s) => s.activeFrameId);
  const storeSetActiveId = useCanvasViewStore((s) => s.setActiveFrameId);

  const frames = props.frames ?? storeFrames;
  const activeId = props.activeId ?? storeActiveId;
  const onChange = props.onChange ?? storeSetActiveId;

  if (frames.length === 0) return <></>;

  return (
    <label className="flex items-center gap-1.5 text-ink-soft">
      <span>{t('editor.frame')}</span>
      <select
        value={activeId}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          onChange(e.target.value);
        }}
        className="rounded border border-border bg-field px-2 py-1 text-ink"
        data-testid="canvas-frame-select"
      >
        {frames.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label} ({String(f.width)}×{String(f.height)})
          </option>
        ))}
      </select>
    </label>
  );
}
