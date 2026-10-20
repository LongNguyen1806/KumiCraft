// Canvas drawing tools toolbar and shared image picker mount (WP-2.09b, R-DT-10..R-DT-15).
import type { DrawTool } from '@reactcraft/shared';
import { useTranslation } from 'react-i18next';

import { useCanvasViewStore } from '../editor/canvas-view-store.ts';
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

function ToolIcon({ tool }: { readonly tool: DrawTool }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d={ICON_PATHS[tool]}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {tool === 'image' && <circle cx="5.2" cy="5.5" r="1" fill="currentColor" />}
    </svg>
  );
}

export function DrawToolbar() {
  const { t } = useTranslation();
  const mode = useCanvasViewStore((s) => s.mode);
  const tool = useCanvasViewStore((s) => s.tool);
  const setTool = useCanvasViewStore((s) => s.setTool);

  if (mode !== 'design') return undefined;

  return (
    <div
      role="toolbar"
      aria-label={t('draw.toolbar')}
      data-testid="draw-toolbar"
      className="flex items-center gap-0.5 rounded-md border border-border bg-field p-0.5"
    >
      {TOOLS.map((item) => {
        const active = tool === item.id;
        const label = t(item.labelKey);
        const titleText = `${label} (${item.shortcut})`;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`draw-tool-${item.id}`}
            aria-pressed={active}
            aria-label={titleText}
            title={titleText}
            onClick={() => {
              setTool(item.id);
            }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${
              active
                ? 'bg-primary text-white shadow-xs'
                : 'text-ink-soft hover:bg-field-hover hover:text-ink'
            }`}
          >
            <ToolIcon tool={item.id} />
            <span>{label}</span>
          </button>
        );
      })}
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
