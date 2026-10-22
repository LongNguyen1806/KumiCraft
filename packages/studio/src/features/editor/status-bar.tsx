import { useTranslation } from 'react-i18next';

import { DrawToolbar } from '../draw/draw-toolbar.tsx';
import { FrameSelect } from './canvas-frame-select.tsx';
import { GridSelect } from './canvas-grid-select.tsx';
import { CanvasZoomSlider } from './canvas-zoom.tsx';

type StatusBarProps = {
  /** S-81: whether the project runs, or stays in restricted mode. */
  readonly trusted: boolean;
};

function StatusTrustBadge({ trusted }: StatusBarProps) {
  const { t } = useTranslation();
  return (
    <span role="status" className="flex items-center gap-2" data-testid="trust-status">
      <span className={`size-2 rounded-full ${trusted ? 'bg-leaf' : 'bg-sun'}`} />
      {t(trusted ? 'editor.trusted' : 'editor.restricted')}
    </span>
  );
}

function StatusCanvasControls() {
  return (
    <div className="flex items-center gap-3" data-testid="status-canvas-controls">
      <FrameSelect />
      <GridSelect />
    </div>
  );
}

/** Bottom row of the Editor: trust state, draw tools, frame size, grid and zoom slider. */
export function StatusBar({ trusted }: StatusBarProps) {
  return (
    <footer className="flex h-9 items-center justify-between gap-4 overflow-hidden rounded-full bg-card px-4 text-xs whitespace-nowrap text-ink-soft shadow-soft">
      <div className="flex items-center gap-3">
        <StatusTrustBadge trusted={trusted} />
        {trusted && <DrawToolbar />}
      </div>
      {trusted && <StatusCanvasControls />}
      <CanvasZoomSlider />
    </footer>
  );
}
