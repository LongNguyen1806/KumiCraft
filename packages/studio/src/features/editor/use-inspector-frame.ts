// What the Inspector needs from the Canvas (spec-log #124): the frame being edited, the primary
// frame and the project's responsive mode. Without them the Inspector read every element as if at
// 1440 px desktop-first and wrote every change unprefixed, whatever frame was selected.
import type { Frame } from '@kumicraft/shared';
import { useMemo } from 'react';

import { useCanvasViewStore } from '../../core/canvas-view-store.ts';
import { useProjectInfo } from '../../core/project-store.ts';
import type { UseInspectorTargetOptions } from '../inspector/types.ts';

const pick = (frames: readonly Frame[], id: string | undefined): Frame | undefined =>
  frames.find((f) => f.id === id) ?? frames[0];

export function useInspectorFrame(): UseInspectorTargetOptions {
  const project = useProjectInfo();
  const storeFrames = useCanvasViewStore((s) => s.frames);
  const activeFrameId = useCanvasViewStore((s) => s.activeFrameId);
  const projectFrames = project?.frames;
  const primaryFrameId = project?.primaryFrameId;
  const responsiveMode = project?.responsiveMode;

  return useMemo(() => {
    const frames = storeFrames.length > 0 ? storeFrames : (projectFrames ?? []);
    const frame = pick(frames, activeFrameId);
    const primaryFrame = pick(frames, primaryFrameId);
    return {
      ...(frame === undefined ? {} : { frame }),
      ...(primaryFrame === undefined ? {} : { primaryFrame }),
      ...(responsiveMode === undefined ? {} : { responsiveMode }),
    };
  }, [storeFrames, projectFrames, activeFrameId, primaryFrameId, responsiveMode]);
}
