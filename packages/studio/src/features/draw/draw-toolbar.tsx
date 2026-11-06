// Canvas drawing tools toolbar and shared image picker mount (WP-2.09b, R-DT-10..R-DT-16, Round S1).
import type { DrawTool } from '@kumicraft/shared';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
import { useEditMode } from '../project/use-edit-mode.ts';
import { useStyleEditable } from '../project/use-style-edit.ts';
import { useImagePickerStore } from './draw-commands.ts';
import { ImagePickerDialog } from './image-picker-dialog.tsx';

type ToolDef = {
  readonly id: DrawTool;
  readonly shortcut: 'V' | 'F' | 'T' | 'I';
  readonly labelKey: 'draw.select' | 'draw.frame' | 'draw.text' | 'draw.image';
};

const TOOLS: readonly ToolDef[] = [
  { id: 'select', shortcut: 'V', labelKey: 'draw.select' },
  { id: 'frame', shortcut: 'F', labelKey: 'draw.frame' },
  { id: 'text', shortcut: 'T', labelKey: 'draw.text' },
  { id: 'image', shortcut: 'I', labelKey: 'draw.image' },
];

const ICON_PATHS: Record<DrawTool, string> = {
  select: 'M3 2L11 6.5L7.2 7.6L5.8 11.5L3 2Z',
  frame: 'M2.2 2.2H11.8V11.8H2.2Z',
  text: 'M3 3H11M7 3V11M5 11H9',
  image: 'M2 2.5H12V11.5H2ZM2.5 10.5L5.8 7.5L8.2 9.5L10 8L11.5 9.5',
};

const PAN_ICON_PATH =
  'M7 1.5V12.5M1.5 7H12.5M5.2 3.3L7 1.5L8.8 3.3M5.2 10.7L7 12.5L8.8 10.7M3.3 5.2L1.5 7L3.3 8.8M10.7 5.2L12.5 7L10.7 8.8';

function ToolIcon({ tool }: { readonly tool: DrawTool | 'pan' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d={tool === 'pan' ? PAN_ICON_PATH : ICON_PATHS[tool]}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {tool === 'image' && <circle cx="5.2" cy="5.5" r="1" fill="currentColor" />}
    </svg>
  );
}

type ToolButtonProps = {
  readonly id: DrawTool | 'pan';
  readonly label: string;
  readonly shortcut: string;
  readonly active: boolean;
  readonly onClick: () => void;
};

function ToolButton({ id, label, shortcut, active, onClick }: ToolButtonProps) {
  const titleText = `${label} (${shortcut})`;
  return (
    <button
      type="button"
      data-testid={`draw-tool-${id}`}
      aria-pressed={active}
      aria-label={titleText}
      title={titleText}
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
        active
          ? 'bg-primary text-white shadow-xs'
          : 'text-ink-soft hover:bg-field-hover hover:text-ink'
      }`}
    >
      <ToolIcon tool={id} />
      <span>{label}</span>
    </button>
  );
}

export function DrawToolbar() {
  const { t } = useTranslation();
  const mode = useCanvasViewStore((s) => s.mode);
  const tool = useCanvasViewStore((s) => s.tool);
  const setTool = useCanvasViewStore((s) => s.setTool);
  const panning = useCanvasViewStore((s) => s.panning);
  const setPanning = useCanvasViewStore((s) => s.setPanning);
  const editable = useStyleEditable();
  const editMode = useEditMode();
  const canDraw = editable && editMode !== 'viewOnly';

  useEffect(() => {
    if (!canDraw && tool !== 'select') {
      setTool('select');
    }
  }, [canDraw, tool, setTool]);

  // Preview: the page takes the clicks, so only Pan is offered (and stays reachable to turn off).
  const visibleTools =
    mode !== 'design' ? [] : canDraw ? TOOLS : TOOLS.filter((item) => item.id === 'select');

  return (
    <div
      role="toolbar"
      aria-label={t('draw.toolbar')}
      data-testid="draw-toolbar"
      className="flex items-center gap-0.5 rounded-md border border-border bg-field p-0.5"
    >
      {visibleTools.map((item) => (
        <ToolButton
          key={item.id}
          id={item.id}
          label={t(item.labelKey)}
          shortcut={item.shortcut}
          active={!panning && tool === item.id}
          onClick={() => {
            setTool(item.id);
          }}
        />
      ))}
      <ToolButton
        id="pan"
        label={t('draw.pan')}
        shortcut="H"
        active={panning}
        onClick={() => {
          setPanning(!panning);
        }}
      />
    </div>
  );
}

export function CanvasImagePicker() {
  const open = useImagePickerStore((s) => s.open);
  const onPick = useImagePickerStore((s) => s.onPick);
  const onCancel = useImagePickerStore((s) => s.onCancel);

  return (
    <ImagePickerDialog
      open={open}
      onClose={onCancel}
      onPick={(choice) => {
        void onPick(choice);
      }}
    />
  );
}
