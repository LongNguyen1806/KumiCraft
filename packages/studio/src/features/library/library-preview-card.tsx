import type { LibraryBlock } from '@kumicraft/shared';

import { renderBlockPreview } from './previews/index.tsx';

type LibraryPreviewCardProps = {
  readonly block?: LibraryBlock | undefined;
  readonly label?: string | undefined;
};

/**
 * Static wireframe SVG preview card shown when hovering or focusing a library tile.
 * Never renders project JSX or iframes.
 * Floats over the bottom of the panel: taking layout space would shrink the tile list, move the
 * hovered tile away from the pointer and make the card flicker on and off.
 */
export function LibraryPreviewCard({ block, label }: LibraryPreviewCardProps) {
  if (block === undefined) return undefined;
  const svg = renderBlockPreview(block.id);
  if (svg === undefined) return undefined;

  return (
    <div
      data-testid={`library-preview-${block.id}`}
      className="border-line bg-card-solid pointer-events-none absolute inset-x-2.5 bottom-2 z-10 flex items-center gap-2.5 rounded-md border p-2 shadow-sm"
    >
      <div className="border-line bg-field shrink-0 overflow-hidden rounded border p-1">{svg}</div>
      <div className="min-w-0 flex-1">
        <div className="text-ink truncate text-[11px] font-medium">{label ?? block.id}</div>
        <div className="text-ink-faint truncate text-[10px]">{block.id}</div>
      </div>
    </div>
  );
}
