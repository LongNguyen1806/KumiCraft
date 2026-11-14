// Helper to build Studio message handler table for BridgeClientRuntime.
import type { ElementRef } from '@kumicraft/shared';

import type { CanvasTools } from './canvas-tools.ts';
import type { DarkStatePreview } from './dark-state-preview.ts';
import type { DragController } from './drag.ts';
import { toggleInteractiveElement } from './interactive-toggle.ts';
import { triggerMotionPreview } from './motion-preview.ts';
import type { BridgeOverlay } from './overlay.ts';
import { runResponsiveAudit } from './responsive-audit.ts';
import type { StudioMessageHandlers } from './studio-messages.ts';
import { cleanProbe, type StylePreview } from './style-preview.ts';
import type { TextEditController } from './text-edit.ts';

export type RuntimeHandlerDeps = {
  readonly getMode: () => 'design' | 'preview';
  readonly setMode: StudioMessageHandlers['setMode'];
  readonly handleSelect: StudioMessageHandlers['handleSelect'];
  readonly handleHighlight: StudioMessageHandlers['handleHighlight'];
  readonly handleNavigate: StudioMessageHandlers['handleNavigate'];
  readonly handleTextEditStart: StudioMessageHandlers['handleTextEditStart'];
  readonly setDesignFile: StudioMessageHandlers['handleDesignFile'];
  readonly textEdit: TextEditController;
  readonly drag: DragController;
  readonly tools: CanvasTools;
  readonly overlay: BridgeOverlay;
  readonly stylePreview: StylePreview;
  readonly darkStatePreview: DarkStatePreview;
  readonly scheduleTreeScan: () => void;
  readonly sendToStudio: (type: string, payload: unknown) => void;
};

function buildNavigationAndDragHandlers(deps: RuntimeHandlerDeps) {
  return {
    setMode: deps.setMode,
    handleSelect: deps.handleSelect,
    handleHighlight: deps.handleHighlight,
    handleNavigate: deps.handleNavigate,
    handleTextEditStart: deps.handleTextEditStart,
    handleDesignFile: deps.setDesignFile,
    commitTextEdit: () => {
      deps.textEdit.commit();
    },
    handleDragOver: (d: Parameters<DragController['studioDragOver']>[0]) => {
      if (deps.getMode() === 'design' && !deps.textEdit.isActive()) deps.drag.studioDragOver(d);
    },
    handleDragEnd: (d: { readonly drop: boolean }) => {
      deps.drag.studioDragEnd(d.drop);
    },
  };
}

function buildToolAndPreviewHandlers(deps: RuntimeHandlerDeps) {
  return {
    handleSetGrid: (d: {
      readonly size: 1 | 4 | 8 | 16;
      readonly snap?: boolean | undefined;
      readonly scale?: number | undefined;
    }) => {
      deps.tools.setGrid(d.size);
      deps.tools.setSnap(d.snap ?? true, d.scale ?? 1);
      deps.overlay.setScale(d.scale ?? 1);
    },
    handleMeasureFree: (ref: ElementRef) => {
      deps.tools.measureFree(ref, document);
    },
    handleSetTool: (tool: Parameters<CanvasTools['setTool']>[0]) => {
      deps.tools.setTool(tool);
    },
    handleStyleProbe: (d: Parameters<typeof cleanProbe>[1]) => {
      deps.sendToStudio('style-probe-result', cleanProbe(deps.stylePreview, d, document));
    },
    handleStylePreview: (d: {
      readonly ref: ElementRef;
      readonly property: Parameters<StylePreview['applyByRef']>[1];
      readonly value: string;
    }) => {
      deps.stylePreview.applyByRef(d.ref, d.property, d.value, document);
    },
    handleStylePreviewClear: () => {
      deps.stylePreview.clearAll();
    },
    handleMotionPreview: (d: Parameters<typeof triggerMotionPreview>[0]) => {
      triggerMotionPreview(d, document);
    },
    handleToggleInteractive: (d: Parameters<typeof toggleInteractiveElement>[0]) => {
      if (toggleInteractiveElement(d, document)) deps.scheduleTreeScan();
    },
    handleResponsiveAudit: (d: { readonly requestId: string }) => {
      deps.sendToStudio('responsive-audit-result', {
        requestId: d.requestId,
        issues: runResponsiveAudit(document, window),
      });
    },
  };
}

function buildInteractionPreviewHandlers(deps: RuntimeHandlerDeps) {
  return {
    handleSetDarkPreview: (d: { readonly dark: boolean }) => {
      deps.darkStatePreview.setDarkPreview(document, d.dark);
    },
    handleSetStatePreview: (d: Parameters<DarkStatePreview['setStatePreview']>[1]) => {
      deps.darkStatePreview.setStatePreview(document, d);
    },
    handleSetSelectPanelPreview: (d: {
      readonly groupRef: ElementRef;
      readonly activeIndex?: number | undefined;
    }) => {
      deps.darkStatePreview.setSelectPanelPreview(document, d.groupRef, d.activeIndex);
    },
  };
}

/** Constructs the dispatched Studio-to-Bridge message handlers under 50 lines per helper. */
export function buildBridgeMessageHandlers(deps: RuntimeHandlerDeps): StudioMessageHandlers {
  return {
    ...buildNavigationAndDragHandlers(deps),
    ...buildToolAndPreviewHandlers(deps),
    ...buildInteractionPreviewHandlers(deps),
  };
}
