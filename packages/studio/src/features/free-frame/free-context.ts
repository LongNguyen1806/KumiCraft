// Shared free frame context and measurement helpers (SPEC-04 section 18E, WP-2.12b).
import type { BridgeFreeMeasurePayload, ElementRef } from '@kumicraft/shared';

import { fetchElementSourceByLoc } from '../../api/source-client.ts';
import { studioBridgeChannel } from '../selection/bridge-channel.ts';
import { useSelectionStore } from '../selection/selection-store.ts';

const MEASURE_TIMEOUT_MS = 2000;

/** Khung tự do chứa phần tử `ref` (cha theo treeNodes có ElementSource.free), hoặc undefined. */
export async function freeFrameOfRef(ref: {
  readonly loc: string;
  readonly index?: number;
}): Promise<{ ref: ElementRef; tag: string } | undefined> {
  const { treeNodes } = useSelectionStore.getState();
  const targetIndex = ref.index ?? 0;
  const nodeIdx = treeNodes.findIndex((n) => n.ref.loc === ref.loc && n.ref.index === targetIndex);
  if (nodeIdx === -1) return undefined;
  const parentIdx = treeNodes[nodeIdx]?.parent;
  if (parentIdx === undefined) return undefined;
  const parentNode = treeNodes[parentIdx];
  if (!parentNode) return undefined;

  try {
    const pSource = await fetchElementSourceByLoc(parentNode.ref.loc);
    if (pSource?.free === true) {
      return { ref: parentNode.ref, tag: parentNode.tag };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Gửi measure-free cho khung, chờ free-measure đúng loc tối đa 2 giây; quá hạn → undefined. */
export function requestFreeMeasure(
  frame: ElementRef,
  onTimeout?: () => void,
): Promise<BridgeFreeMeasurePayload | undefined> {
  return new Promise((resolve) => {
    let resolved = false;
    const cleanup: { unregister?: () => void } = {};

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup.unregister?.();
        onTimeout?.();
        resolve(undefined);
      }
    }, MEASURE_TIMEOUT_MS);

    cleanup.unregister = studioBridgeChannel.registerFreeFrameListener({
      onFreeMeasure: (payload) => {
        if (payload.ref.loc === frame.loc && payload.ref.index === frame.index) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup.unregister?.();
            resolve(payload);
          }
        }
      },
    });

    studioBridgeChannel.measureFree(frame);
  });
}
