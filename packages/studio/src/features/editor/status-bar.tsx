import type { Frame } from '@kumicraft/shared';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { MAX_OPEN_FRAMES } from '../../core/open-frames-storage.ts';
import { useProjectInfo } from '../../core/project-store.ts';
import { BuildCheckButton } from '../build-check/build-check-button.tsx';
import { DrawToolbar } from '../draw/draw-toolbar.tsx';
import { stylingLabel } from '../project/styling-label.ts';
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
      <span className="@max-[1000px]:sr-only">
        {t(trusted ? 'editor.trusted' : 'editor.restricted')}
      </span>
    </span>
  );
}

function StatusStylingBadge() {
  const { t } = useTranslation();
  const project = useProjectInfo();
  const styling =
    project?.support.styling ??
    (project?.support.tailwindCss !== undefined
      ? {
          systems: [{ id: 'tailwind' as const, version: project.support.versions.tailwindcss }],
          primary: 'tailwind' as const,
          editable: true,
          globalCss: [project.support.tailwindCss],
        }
      : undefined);

  const info = stylingLabel(styling, t);

  return (
    <span
      data-testid="styling-label"
      title={info.fullDescription}
      className="cursor-default rounded-md bg-field px-1.5 py-0.5 font-mono text-[11px] text-ink-soft select-none"
    >
      {info.shortLabel}
    </span>
  );
}

type MenuAnchor = { readonly left: number; readonly bottom: number };

type AddFrameMenuProps = {
  readonly frames: readonly Frame[];
  readonly anchor: MenuAnchor;
  readonly menuRef: { current?: HTMLDivElement | undefined };
  readonly onSelect: (id: string) => void;
};

/**
 * Drawn on document.body just above the button: the status bar clips its overflow, so a menu
 * inside it would be cut off and hidden behind the Canvas.
 */
function AddFrameMenu({ frames, anchor, menuRef, onSelect }: AddFrameMenuProps) {
  return createPortal(
    <div
      ref={(el) => {
        menuRef.current = el ?? undefined;
      }}
      data-testid="add-frame-menu"
      style={{ left: `${String(anchor.left)}px`, bottom: `${String(anchor.bottom)}px` }}
      className="fixed z-50 min-w-36 rounded-lg border border-border bg-card-solid p-1 shadow-soft text-xs"
    >
      {frames.map((f) => (
        <button
          key={f.id}
          type="button"
          data-testid={`add-frame-item-${f.id}`}
          onClick={() => {
            onSelect(f.id);
          }}
          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-ink hover:bg-field"
        >
          <span>{f.label}</span>
          <span className="text-[10px] text-ink-soft">
            {f.width}×{f.height}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

type ElementBox = { readonly current?: HTMLElement | undefined };

/** Closes on a press outside the given elements (the toggle button counts as inside). */
function useCloseOnOutsideClick(
  open: boolean,
  inside: readonly ElementBox[],
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    const handleDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      const target = e.target;
      if (inside.some((box) => box.current?.contains(target) === true)) return;
      onClose();
    };
    window.addEventListener('mousedown', handleDown);
    return () => {
      window.removeEventListener('mousedown', handleDown);
    };
  }, [open, inside, onClose]);
}

function AddFrameButton() {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<MenuAnchor>();
  const open = anchor !== undefined;
  const menuRef = useRef<HTMLDivElement>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(undefined);
  const openFrames = useCanvasViewStore((s) => s.openFrames);
  const frames = useCanvasViewStore((s) => s.frames);
  const addOpenFrame = useCanvasViewStore((s) => s.addOpenFrame);
  const isMax = openFrames.length >= MAX_OPEN_FRAMES;

  useCloseOnOutsideClick(open, [menuRef, buttonRef], () => {
    setAnchor(undefined);
  });

  return (
    <div className="relative">
      <button
        ref={(el) => {
          buttonRef.current = el ?? undefined;
        }}
        type="button"
        data-testid="add-frame-btn"
        disabled={isMax}
        onClick={(e) => {
          if (isMax) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setAnchor(
            open ? undefined : { left: rect.left, bottom: window.innerHeight - rect.top + 4 },
          );
        }}
        title={isMax ? t('editor.addFrameMax') : t('editor.addFrame')}
        aria-label={t('editor.addFrame')}
        className="flex h-6 items-center gap-1 rounded-md border border-line bg-card-solid px-2 text-xs text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-3.5" />
        <span className="@max-[1100px]:sr-only">{t('editor.addFrame')}</span>
      </button>
      {anchor !== undefined && !isMax && (
        <AddFrameMenu
          frames={frames}
          anchor={anchor}
          menuRef={menuRef}
          onSelect={(id) => {
            addOpenFrame(id);
            setAnchor(undefined);
          }}
        />
      )}
    </div>
  );
}

function StatusCanvasControls() {
  return (
    <div className="flex min-w-0 items-center gap-2.5" data-testid="status-canvas-controls">
      <AddFrameButton />
      <FrameSelect />
      <GridSelect />
    </div>
  );
}

/**
 * Bottom row of the Editor: trust state, draw tools, frame size, grid and zoom slider. It sizes
 * itself to its own width (a container), so names give way to icons before anything is cut off.
 */
export function StatusBar({ trusted }: StatusBarProps) {
  return (
    <footer className="@container flex h-[34px] shrink-0 items-center justify-between gap-3 overflow-hidden border-t border-line bg-card-solid px-2.5 text-xs whitespace-nowrap text-ink-soft">
      <div className="flex min-w-0 items-center gap-2.5">
        <StatusTrustBadge trusted={trusted} />
        <StatusStylingBadge />
        {trusted && <BuildCheckButton />}
        {trusted && <DrawToolbar />}
      </div>
      {trusted && <StatusCanvasControls />}
      <div className="shrink-0">
        <CanvasZoomSlider />
      </div>
    </footer>
  );
}
