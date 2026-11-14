// Schemas and types for Bridge protocol (SPEC-03 section 7, V-110..114).
import { z } from 'zod';

import { RelPathSchema } from './rel-path.ts';
import { ElementGuardSchema, InsertTargetSchema } from './source.ts';
import { PlacementSchema } from './tailwind/free-position.ts';

export const ElementRefSchema = z.strictObject({
  loc: z.string().min(1),
  index: z.number().int().min(0),
});
export type ElementRef = z.infer<typeof ElementRefSchema>;

export const RectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type Rect = z.infer<typeof RectSchema>;

export const ElementA11yInfoSchema = z.strictObject({
  hasText: z.boolean(),
  textLength: z.number().int().min(0).optional(),
  contrast: z.number().min(0).max(21).optional(),
  textColor: z.string().max(64).optional(),
  bgColor: z.string().max(64).optional(),
  missingAlt: z.boolean(),
  missingAccessibleName: z.boolean(),
  unlabeledInput: z.boolean(),
});
export type ElementA11yInfo = z.infer<typeof ElementA11yInfoSchema>;

export const ElementInfoSchema = z.strictObject({
  ref: ElementRefSchema,
  found: z.boolean(),
  tag: z.string().min(1),
  rect: RectSchema.optional(),
  instances: z.number().int().min(1),
  domClass: z.string().max(4000).optional(),
  /**
   * Elements with `data-rc-loc` around this one in the page, nearest first. Unlike `tree`, which only
   * lists the children of a repeated element's first copy, this is the real chain of this copy.
   */
  ancestors: z.array(ElementRefSchema).max(200).optional(),
  a11y: ElementA11yInfoSchema.optional(),
});
export type ElementInfo = z.infer<typeof ElementInfoSchema>;

export const TreeNodeSchema = z.strictObject({
  ref: ElementRefSchema,
  parent: z.number().int().min(0).optional(),
  tag: z.string().min(1),
  label: z.string().max(100).optional(),
  instances: z.number().int().min(1),
});
export type TreeNode = z.infer<typeof TreeNodeSchema>;

/** V-110..V-114: Bridge message envelope. */
export const BridgeEnvelopeSchema = z.strictObject({
  rc: z.literal(1),
  nonce: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
});
export type BridgeEnvelope = z.infer<typeof BridgeEnvelopeSchema>;

// Payloads from Bridge to Studio
export const BridgeReadyPayloadSchema = z.strictObject({
  bridgeVersion: z.string().min(1),
  route: z.string(),
});
export type BridgeReadyPayload = z.infer<typeof BridgeReadyPayloadSchema>;

export const BridgeHoverPayloadSchema = z.strictObject({
  ref: ElementRefSchema.optional(),
});
export type BridgeHoverPayload = z.infer<typeof BridgeHoverPayloadSchema>;

export const BridgeSelectPayloadSchema = z.strictObject({
  refs: z.array(ElementRefSchema),
});
export type BridgeSelectPayload = z.infer<typeof BridgeSelectPayloadSchema>;

export const BridgeSelectionInfoPayloadSchema = z.strictObject({
  items: z.array(ElementInfoSchema),
});
export type BridgeSelectionInfoPayload = z.infer<typeof BridgeSelectionInfoPayloadSchema>;

export const BridgeTreePayloadSchema = z.strictObject({
  nodes: z.array(TreeNodeSchema).max(5000),
  truncated: z.boolean().optional(),
});
export type BridgeTreePayload = z.infer<typeof BridgeTreePayloadSchema>;

export const BridgeRoutePayloadSchema = z.strictObject({
  route: z.string(),
});
export type BridgeRoutePayload = z.infer<typeof BridgeRoutePayloadSchema>;

export const BridgeRuntimeErrorPayloadSchema = z.strictObject({
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
});
export type BridgeRuntimeErrorPayload = z.infer<typeof BridgeRuntimeErrorPayloadSchema>;

export const BridgeShortcutPayloadSchema = z.strictObject({
  key: z.string(),
  ctrl: z.boolean(),
  meta: z.boolean(),
  shift: z.boolean(),
  alt: z.boolean(),
});
export type BridgeShortcutPayload = z.infer<typeof BridgeShortcutPayloadSchema>;

/**
 * Ctrl + wheel or a touchpad pinch inside the page: the Studio zooms the Canvas around the pointer
 * (Canvas navigation). The pointer comes as a fraction of the page's viewport, so the Studio places
 * it on the frame whatever the zoom.
 */
export const BridgeCanvasZoomPayloadSchema = z.strictObject({
  deltaY: z.number().min(-10_000).max(10_000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type BridgeCanvasZoomPayload = z.infer<typeof BridgeCanvasZoomPayloadSchema>;

/** A middle-button drag inside the page, in screen pixels: the Studio pans the Canvas. */
export const BridgeCanvasPanPayloadSchema = z.strictObject({
  phase: z.enum(['start', 'move', 'end']),
  screenX: z.number(),
  screenY: z.number(),
});
export type BridgeCanvasPanPayload = z.infer<typeof BridgeCanvasPanPayloadSchema>;

export const BridgeTextEditRequestPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type BridgeTextEditRequestPayload = z.infer<typeof BridgeTextEditRequestPayloadSchema>;

export const BridgeTextCommitPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  text: z.string(),
});
export type BridgeTextCommitPayload = z.infer<typeof BridgeTextCommitPayloadSchema>;

export const BridgeTextCancelPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type BridgeTextCancelPayload = z.infer<typeof BridgeTextCancelPayloadSchema>;

// Payloads from Studio to Bridge
export const StudioSetModePayloadSchema = z.strictObject({
  mode: z.enum(['design', 'preview']),
});
export type StudioSetModePayload = z.infer<typeof StudioSetModePayloadSchema>;

export const StudioSelectPayloadSchema = z.strictObject({
  refs: z.array(ElementRefSchema),
  reveal: z.boolean(),
});
export type StudioSelectPayload = z.infer<typeof StudioSelectPayloadSchema>;

export const StudioHighlightPayloadSchema = z.strictObject({
  ref: ElementRefSchema.optional(),
});
export type StudioHighlightPayload = z.infer<typeof StudioHighlightPayloadSchema>;

export const StudioTextEditStartPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type StudioTextEditStartPayload = z.infer<typeof StudioTextEditStartPayloadSchema>;

export const StudioTextEditEndPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type StudioTextEditEndPayload = z.infer<typeof StudioTextEditEndPayloadSchema>;

export const StudioToggleInteractivePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  open: z.boolean().optional(),
});
export type StudioToggleInteractivePayload = z.infer<typeof StudioToggleInteractivePayloadSchema>;

export const BridgeBuildErrorPayloadSchema = z.strictObject({
  message: z.string().max(2000),
  /** Relative to the project root (R-BR-17). */
  file: z.string().max(1024).optional(),
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
});
export type BridgeBuildErrorPayload = z.infer<typeof BridgeBuildErrorPayloadSchema>;

export const StudioNavigatePayloadSchema = z.strictObject({
  route: z.string().min(1).max(2048),
});
export type StudioNavigatePayload = z.infer<typeof StudioNavigatePayloadSchema>;

export const DropRectSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type DropRect = z.infer<typeof DropRectSchema>;

// Bridge -> Studio. {} = currently no valid drop target (spec-log #21).
export const BridgeDropTargetPayloadSchema = z.union([
  z.strictObject({
    target: InsertTargetSchema,
    rect: DropRectSchema,
    label: z.string().max(100),
    placement: PlacementSchema.optional(),
  }),
  z.strictObject({}),
]);
export type BridgeDropTargetPayload = z.infer<typeof BridgeDropTargetPayloadSchema>;

// Bridge -> Studio, when dropping a drag inside Canvas (R-DD-14).
export const BridgeMoveIntentPayloadSchema = z.strictObject({
  elements: z.array(ElementGuardSchema).min(1).max(50),
  target: InsertTargetSchema,
  placement: PlacementSchema.optional(),
});
export type BridgeMoveIntentPayload = z.infer<typeof BridgeMoveIntentPayloadSchema>;

// Studio -> Bridge (R-DD-10). x, y are iframe viewport coords, already divided by zoom.
export const StudioDragOverPayloadSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  source: z.enum(['library', 'layer']),
  refs: z.array(ElementRefSchema).max(50).optional(),
});
export type StudioDragOverPayload = z.infer<typeof StudioDragOverPayloadSchema>;

export const StudioDragEndPayloadSchema = z.strictObject({ drop: z.boolean() });
export type StudioDragEndPayload = z.infer<typeof StudioDragEndPayloadSchema>;

// Studio -> Bridge (R-CP-11, R-CP-15). file missing/undefined: unknown design file.
export const StudioDesignFilePayloadSchema = z.strictObject({
  file: RelPathSchema.optional(),
  focus: z.boolean().optional(),
});
export type StudioDesignFilePayload = z.infer<typeof StudioDesignFilePayloadSchema>;

// Studio -> Bridge: set-grid: lưới hiện hành (R-FF-11), and the snap switch with the Canvas zoom
// (spec-log #125) so the snap reach stays the same on screen. Both are optional for older Studios.
export const StudioSetGridPayloadSchema = z.strictObject({
  size: z.union([z.literal(1), z.literal(4), z.literal(8), z.literal(16)]),
  snap: z.boolean().optional(),
  scale: z.number().positive().optional(),
});
export type StudioSetGridPayload = z.infer<typeof StudioSetGridPayloadSchema>;

// Studio -> Bridge: measure-free: đo con trực tiếp của một phần tử trước khi bật khung tự do (R-FF-10)
export const StudioMeasureFreePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
});
export type StudioMeasureFreePayload = z.infer<typeof StudioMeasureFreePayloadSchema>;

// Bridge -> Studio: trả lời measure-free (R-FF-10)
export const BridgeFreeMeasurePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  /** Rendered size of the frame's padding box (px); align to parent uses it (R-FF-17). */
  width: z.number(),
  height: z.number(),
  hasHeight: z.boolean(),
  /**
   * The frame's width comes from its content (absolute, inline-block, a flex item…) and no class
   * sets it: turning it on must keep the width, or the frame collapses once its children leave the
   * flow (spec-log #129). Optional for older Bridges.
   */
  keepWidth: z.boolean().optional(),
  children: z
    .array(
      z.strictObject({
        ref: ElementRefSchema,
        tag: z.string(),
        left: z.number(),
        top: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    )
    .max(200),
});
export type BridgeFreeMeasurePayload = z.infer<typeof BridgeFreeMeasurePayloadSchema>;

// Bridge -> Studio: nhả chuột sau khi kéo di chuyển trong khung (R-FF-13)
export const BridgeFreeMovePayloadSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        ref: ElementRefSchema,
        tag: z.string(),
        left: z.number(),
        top: z.number(),
      }),
    )
    .min(1)
    .max(50),
});
export type BridgeFreeMovePayload = z.infer<typeof BridgeFreeMovePayloadSchema>;

// Bridge -> Studio: nhả chuột sau khi kéo giãn (R-FF-14)
export const BridgeFreeResizePayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  tag: z.string(),
  left: z.number().optional(),
  top: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  resetSize: z.boolean().optional(),
});
export type BridgeFreeResizePayload = z.infer<typeof BridgeFreeResizePayloadSchema>;

// Bridge -> Studio, type 'layer-menu' (R-SL-13)
export const LayerMenuItemSchema = z.strictObject({
  ref: ElementRefSchema,
  tag: z.string().min(1),
  label: z.string().max(100).optional(),
});
export type LayerMenuItem = z.infer<typeof LayerMenuItemSchema>;

export const BridgeLayerMenuPayloadSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  items: z.array(LayerMenuItemSchema).min(1).max(30),
});
export type BridgeLayerMenuPayload = z.infer<typeof BridgeLayerMenuPayloadSchema>;

// Bridge -> Studio, type 'layer-menu-close', payload {} (bấm chuột hoặc cuộn trong iframe)
export const BridgeLayerMenuClosePayloadSchema = z.strictObject({});
export type BridgeLayerMenuClosePayload = z.infer<typeof BridgeLayerMenuClosePayloadSchema>;

// Công cụ vẽ trên Canvas (R-DT-10..R-DT-15, spec-log #32)
export const DRAW_TOOLS = ['select', 'frame', 'text', 'image'] as const;
export const DrawToolSchema = z.enum(DRAW_TOOLS);
export type DrawTool = z.infer<typeof DrawToolSchema>;

// Studio -> Bridge, type 'set-tool'
export const StudioSetToolPayloadSchema = z.strictObject({
  tool: DrawToolSchema,
});
export type StudioSetToolPayload = z.infer<typeof StudioSetToolPayloadSchema>;

// Bridge -> Studio, type 'draw-end'
export const BridgeDrawEndPayloadSchema = z.strictObject({
  tool: z.enum(['frame', 'text', 'image']),
  target: InsertTargetSchema,
  /** Kích thước hộp đã kéo (px). Bấm mà không kéo (< 8px) thì không có. */
  size: z
    .strictObject({
      width: z.number().int().min(8).max(4096),
      height: z.number().int().min(8).max(4096),
    })
    .optional(),
  /** Bề rộng khung chứa (px) để Studio đổi sang w-full khi gần bằng. */
  containerWidth: z.number().int().min(0).max(16384),
  /** Có khi vẽ vào một khung tự do (R-FF-11, R-DT-11..14). */
  placement: PlacementSchema.optional(),
});
export type BridgeDrawEndPayload = z.infer<typeof BridgeDrawEndPayloadSchema>;

/** Bridge -> Studio, type 'text-select' (TK-3: selection range inside text-edit). */
export const BridgeTextSelectPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  rect: RectSchema.optional(),
});
export type BridgeTextSelectPayload = z.infer<typeof BridgeTextSelectPayloadSchema>;

/** Studio -> Bridge, type 'motion-preview' (TK-22: replay animation once on canvas without editing files). */
export const StudioMotionPreviewPayloadSchema = z.strictObject({
  ref: ElementRefSchema,
  className: z.string().min(1).max(200).optional(),
  durationMs: z.number().int().min(100).max(5000).optional(),
});
export type StudioMotionPreviewPayload = z.infer<typeof StudioMotionPreviewPayloadSchema>;

/** Studio -> Bridge, type 'responsive-audit' (TK-66: check horizontal overflow and sibling overlap). */
export const StudioResponsiveAuditPayloadSchema = z.strictObject({
  requestId: z.string().min(1).max(64),
});
export type StudioResponsiveAuditPayload = z.infer<typeof StudioResponsiveAuditPayloadSchema>;

export const ResponsiveAuditIssueSchema = z.strictObject({
  ref: ElementRefSchema,
  tag: z.string().min(1),
  kind: z.enum(['overflow', 'overlap']),
  detail: z.string().max(200).optional(),
  frameId: z.string().optional(),
  frameLabel: z.string().optional(),
  width: z.number().int().positive().optional(),
});
export type ResponsiveAuditIssue = z.infer<typeof ResponsiveAuditIssueSchema>;

/** Bridge -> Studio, type 'responsive-audit-result' (TK-66). */
export const BridgeResponsiveAuditResultPayloadSchema = z.strictObject({
  requestId: z.string().min(1).max(64),
  issues: z.array(ResponsiveAuditIssueSchema).max(200),
});
export type BridgeResponsiveAuditResultPayload = z.infer<
  typeof BridgeResponsiveAuditResultPayloadSchema
>;
