import type { LibraryBlock } from '@kumicraft/shared';

import { renderBlockPreview } from './previews/index.tsx';

/** Screen position (viewport px) where the preview card floats: right of the Library panel. */
export type PreviewAnchor = { readonly left: number; readonly top: number };

export type PreviewHandler = (
  block: LibraryBlock | undefined,
  label?: string,
  anchor?: PreviewAnchor,
) => void;

const CARD_GAP = 8;
const CARD_MAX_HEIGHT = 120;

/** Places the card beside the hovered tile, outside the panel, so it never covers any tile. */
export function previewAnchorOf(tile: HTMLElement): PreviewAnchor {
  const tileRect = tile.getBoundingClientRect();
  const panel = tile.closest('[data-testid="library-panel"]');
  const right = panel instanceof HTMLElement ? panel.getBoundingClientRect().right : tileRect.right;
  return { left: right + CARD_GAP, top: tileRect.top };
}

type LibraryPreviewCardProps = {
  readonly block?: LibraryBlock | undefined;
  readonly label?: string | undefined;
  readonly anchor?: PreviewAnchor | undefined;
};

/**
 * Static wireframe SVG preview card shown when hovering or focusing a library tile.
 * Never renders project JSX or iframes. It floats beside the panel (fixed position): inside the
 * panel it would cover tiles, flicker on hover and end up in the drag image.
 */
export function LibraryPreviewCard({ block, label, anchor }: LibraryPreviewCardProps) {
  if (block === undefined || anchor === undefined) return undefined;
  const svg = renderBlockPreview(block.id);
  if (svg === undefined) return undefined;
  const maxTop = Math.max(CARD_GAP, window.innerHeight - CARD_MAX_HEIGHT - CARD_GAP);

  return (
    <div
      data-testid={`library-preview-${block.id}`}
      style={{ left: anchor.left, top: Math.min(Math.max(anchor.top, CARD_GAP), maxTop) }}
      className="border-line bg-card-solid pointer-events-none fixed z-50 flex w-72 items-center gap-2.5 rounded-md border p-2 shadow-lg"
    >
      <div className="border-line bg-field shrink-0 overflow-hidden rounded border p-1">{svg}</div>
      <div className="min-w-0 flex-1">
        <div className="text-ink truncate text-[11px] font-medium">{label ?? block.id}</div>
        <div className="text-ink-faint truncate text-[10px]">{block.id}</div>
      </div>
    </div>
  );
}
