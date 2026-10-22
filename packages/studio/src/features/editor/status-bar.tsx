import { useTranslation } from 'react-i18next';

import { CanvasZoomSlider } from './canvas-zoom.tsx';

type StatusBarProps = {
  /** S-81: whether the project runs, or stays in restricted mode. */
  readonly trusted: boolean;
};

/** Bottom row of the Editor: the trust state now; dev server state, selection, and zoom controls. */
export function StatusBar({ trusted }: StatusBarProps) {
  const { t } = useTranslation();
  return (
    <footer className="flex h-[34px] items-center justify-between gap-4 overflow-hidden rounded-full bg-card px-4 text-xs whitespace-nowrap text-ink-soft shadow-soft">
      <span role="status" className="flex items-center gap-2" data-testid="trust-status">
        <span className={`size-2 rounded-full ${trusted ? 'bg-leaf' : 'bg-sun'}`} />
        {t(trusted ? 'editor.trusted' : 'editor.restricted')}
      </span>
      <CanvasZoomSlider />
    </footer>
  );
}
