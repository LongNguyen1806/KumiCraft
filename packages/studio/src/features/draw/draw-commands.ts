// Studio commands for handling Bridge draw-end messages (WP-2.09b, R-DT-11..R-DT-15).
import { LIBRARY_BLOCKS } from '@kumicraft/content';
import { type BridgeDrawEndPayload, type InsertTarget, type Placement } from '@kumicraft/shared';
import { pxClass } from '@kumicraft/style-tailwind';
import i18next from 'i18next';
import { create } from 'zustand';

import { studioBridgeChannel } from '../../core/bridge-channel.ts';
import { placementTailwindMajor, useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useDndStore } from '../../core/dnd-store.ts';
import { sendStructureEdit } from '../../core/edits.ts';
import { useSelectionStore } from '../../core/selection-store.ts';
import { toErrorInfo } from '../../routes/error-text.ts';
import { localizedBlockJsx } from '../library/insert-block.ts';
import { getSelectedVariant } from '../library/library-variants.ts';
import { insertImageAt, type InsertImageChoice } from './insert-image.ts';

const FULL_WIDTH_TOLERANCE_PX = 8;
const TEXT_EDIT_WAIT_MS = 3000;

export type PendingImageInsert = {
  readonly target: InsertTarget;
  readonly className: string;
  readonly placement?: Placement | undefined;
};

export type ImagePickerStoreState = {
  readonly open: boolean;
  readonly pending?: PendingImageInsert | undefined;
  readonly requestImage: (pending: PendingImageInsert) => void;
  readonly onPick: (choice: InsertImageChoice) => Promise<void>;
  readonly onCancel: () => void;
};

export const useImagePickerStore = create<ImagePickerStoreState>((set, get) => ({
  open: false,
  pending: undefined,
  requestImage: (pending) => {
    set({ open: true, pending });
  },
  onPick: async (choice) => {
    const pending = get().pending;
    set({ open: false, pending: undefined });
    useCanvasViewStore.getState().setTool('select');
    if (pending === undefined) return;
    const res = await insertImageAt(pending.target, choice, {
      className: pending.className,
      placement: pending.placement,
    });
    if (!res.ok && res.error !== undefined) {
      useDndStore.getState().setError(res.error);
    }
  },
  onCancel: () => {
    set({ open: false, pending: undefined });
    useCanvasViewStore.getState().setTool('select');
  },
}));

function widthToken(width: number, containerWidth: number, tailwindMajor: 3 | 4): string {
  if (Math.abs(width - containerWidth) <= FULL_WIDTH_TOLERANCE_PX) return 'w-full';
  return pxClass('w', width, tailwindMajor);
}

function buildFrameJsx(payload: BridgeDrawEndPayload, tailwindMajor: 3 | 4): string {
  if (payload.placement !== undefined) {
    return '<div className="rounded-md bg-slate-100"></div>';
  }
  if (payload.size === undefined) {
    return '<div className="h-24 w-full rounded-md bg-slate-100"></div>';
  }
  const w = widthToken(payload.size.width, payload.containerWidth, tailwindMajor);
  const h = pxClass('h', payload.size.height, tailwindMajor);
  return `<div className="${w} ${h} rounded-md bg-slate-100"></div>`;
}

function buildImageClassName(payload: BridgeDrawEndPayload, tailwindMajor: 3 | 4): string {
  if (payload.placement !== undefined) return '';
  if (payload.size === undefined) return 'w-full h-auto';
  const w = widthToken(payload.size.width, payload.containerWidth, tailwindMajor);
  return `${w} h-auto`;
}

function startTextEditWhenInTree(loc: string): void {
  const ref = { loc, index: 0 };
  if (useSelectionStore.getState().treeNodes.some((n) => n.ref.loc === loc)) {
    studioBridgeChannel.requestTextEdit(ref);
    return;
  }
  let done = false;
  const unsubscribe = useSelectionStore.subscribe((state) => {
    if (done) return;
    if (state.treeNodes.some((n) => n.ref.loc === loc)) {
      done = true;
      clearTimeout(timer);
      unsubscribe();
      studioBridgeChannel.requestTextEdit(ref);
    }
  });
  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    unsubscribe();
  }, TEXT_EDIT_WAIT_MS);
}

function paragraphJsx(): string {
  const block = LIBRARY_BLOCKS.find((b) => b.id === 'content.paragraph');
  const lang = i18next.language || 'en';
  return block
    ? localizedBlockJsx(block, lang, getSelectedVariant(block.id))
    : '<p className="text-base text-slate-600"></p>';
}

export async function handleDrawEnd(payload: BridgeDrawEndPayload): Promise<void> {
  const { tailwindMajor, setTool } = useCanvasViewStore.getState();
  setTool('select');

  if (payload.tool === 'image') {
    const className = buildImageClassName(payload, tailwindMajor);
    useImagePickerStore.getState().requestImage({
      target: payload.target,
      className,
      placement: payload.placement,
    });
    return;
  }

  const jsx = payload.tool === 'frame' ? buildFrameJsx(payload, tailwindMajor) : paragraphJsx();

  try {
    const res = await sendStructureEdit({
      kind: 'insert',
      target: payload.target,
      jsx,
      placement: payload.placement,
      tailwindMajor: placementTailwindMajor(payload.placement),
    });
    const newLoc = res.locs[0];
    if (newLoc !== undefined) {
      useSelectionStore.getState().setSelectedRefs([{ loc: newLoc, index: 0 }]);
      if (payload.tool === 'text') {
        startTextEditWhenInTree(newLoc);
      }
    }
  } catch (err) {
    useDndStore.getState().setError(toErrorInfo(err));
  }
}
